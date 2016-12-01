package api

import (
	"github.com/astaxie/beego"
	"github.com/vmware/harbor/dao"
	"github.com/vmware/harbor/utils/log"
	"net/http"
	"io/ioutil"
	"strings"
	"encoding/base64"
	"encoding/json"
	"os"
	"bytes"
	"strconv"
	"github.com/vmware/harbor/models"
	"bufio"
	"io"
)

var harbor_reg_url = os.Getenv("HARBOR_REG_URL")
var host_url = os.Getenv("DOCKER_HOST_URL")

type ImagesAPI struct {
	BaseAPI
	userName    string
}
type AuthConfig struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

func (build *ImagesAPI) Push() {
	repoName := build.GetString("repoName")
	projectId,_ := build.GetInt64("project_id")
	projectName := getProjectNameById(projectId, build)
	if len(projectName) == 0{
		build.RenderError(http.StatusBadRequest, "Project with Id: "+strconv.FormatInt(int64(projectId),10)    +" does not exist")
		return
	}

	userId:= build.ValidateUser()
	query := models.User{UserID:userId}
	user,err:=dao.GetUser(query)
	if err != nil{
		build.RenderError(http.StatusBadRequest, "user with Id: "+strconv.FormatInt(int64(userId),10)    +" does not exist")
		return
	}
	//validated user permission
	if !checkUserPermission(user.Username,projectName){
		build.Ctx.Output.ContentType("application/json")
		build.Ctx.WriteString("You have right to build images,permisson deny!")
		build.Ctx.Output.Context.ResponseWriter.Flush()
		build.Ctx.Output.SetStatus(http.StatusUnauthorized)
		return
	}
	build.userName=user.Username
	fi, h, err := build.GetFile("file")
	defer fi.Close()
	beego.Debug("filename=" + h.Filename)
	beego.Debug("repoName=" + repoName)
	var buf bytes.Buffer
	buf.WriteString(host_url)
	buf.WriteString("/build?t=")
	buf.WriteString(harbor_reg_url)
	buf.WriteString("/")
	buf.WriteString(projectName)
	buf.WriteString("/")
	buf.WriteString(repoName)
	//imgUrl := "http://192.168.101.122:4243/build?t="+tmpRepoName
	beego.Debug("imgUrl=====" + buf.String())
	var imgFullName, tag string
	var nameBuf bytes.Buffer
	nameBuf.WriteString(harbor_reg_url)
	nameBuf.WriteString("/")
	nameBuf.WriteString(projectName)
	nameBuf.WriteString("/")
	if strings.Contains(repoName, ":") {
		imgFullName = nameBuf.String() + strings.Split(repoName, ":")[0]
		beego.Debug("imgFullName=====" + imgFullName)
		tag = strings.Split(repoName, ":")[1]
		beego.Debug("tag=====" + tag)
	} else {
		imgFullName = nameBuf.String() + repoName
		tag = "latest"
	}
	client := &http.Client{}
	req, _ := http.NewRequest("POST", buf.String(), fi)
	req.Header.Set("Content-Type", "application/tar")
	resp, err := client.Do(req)
	if err == nil{
		defer resp.Body.Close()
	}
	var imageId string
	rb := bufio.NewReaderSize(resp.Body,512)
	for {
		line,_,err := rb.ReadLine()
		if err == io.EOF{
			break
		}else{
			tempLine :=(string(line))
			if strings.Contains(tempLine, "Successfully built"){
				imageId = tempLine[strings.LastIndexAny(tempLine," ")+1:len(tempLine)-4]
				beego.Debug("imageId====="+imageId)
			}
			var outline string
			if strings.Contains(tempLine,"\"}"){
				outline =strings.Replace(tempLine,"\"}","\"}\n",-1)
			}
			build.Ctx.Output.ContentType("application/json")
			build.Ctx.WriteString(outline)
			build.Ctx.Output.Context.ResponseWriter.Flush()
		}
	}
	if len(imageId) > 0 {
		pushImage(imgFullName, tag, imageId, build)
	}
}

func newAuthConfig(username, password string) string {
	authConfig := &AuthConfig{
		Username:username,
		Password:password,
	}
	authConfigByte, _ := json.Marshal(authConfig)
	beego.Debug(base64UrlEncode(authConfigByte))
	return base64UrlEncode(authConfigByte)
}
func pushImage(imgFullName string, tag string, imageId string, build *ImagesAPI) {
	var buf bytes.Buffer
	buf.WriteString(host_url)
	buf.WriteString("/images/")
	buf.WriteString(imgFullName)
	buf.WriteString("/push?tag=")
	buf.WriteString(tag)
	//imgUrl := "http://192.168.101.122:4243/images/"+imgFullName+"/push?tag="+tag
	beego.Debug("pushUrl=====" + buf.String())
	client := &http.Client{}
	req, _ := http.NewRequest("POST", buf.String(), nil)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Registry-Auth", newAuthConfig(build.userName, "password"))
	resp, err := client.Do(req)
	if err == nil{
		defer resp.Body.Close()
	}
	outPutResult(resp.Body,build)
	deleteImg(imageId)
	build.Ctx.WriteString("build success!")
}

func deleteImg(imageId string) {
	var buf bytes.Buffer
	buf.WriteString(host_url)
	buf.WriteString("/images/")
	buf.WriteString(imageId)
	buf.WriteString("?force=1")
	beego.Debug("deleteUrl=====" + buf.String())
	req, _ := http.NewRequest("DELETE", buf.String(), nil)
	client := &http.Client{}
	req.Header.Set("Content-Type", "application/json")
	resp, _ := client.Do(req)
	defer resp.Body.Close()
}

func (build *ImagesAPI) Pull() {
	imageName := build.GetString("fromImage")
	imageName = strings.TrimSpace(imageName)
	if !strings.Contains(imageName,":"){
		imageName = imageName+":latest"
	}
	projectId, _:= build.GetInt64("project_id")
	projectName := getProjectNameById(projectId, build)
	if len(projectName) == 0{
		build.RenderError(http.StatusBadRequest, "Project with Id: "+strconv.FormatInt(int64(projectId),10)    +" does not exist")
		return
	}

	userId:= build.ValidateUser()
	query := models.User{UserID:userId}
	user,err:=dao.GetUser(query)
	if err != nil{
		build.RenderError(http.StatusBadRequest, "user with Id: "+strconv.FormatInt(int64(userId),10)    +" does not exist")
		return
	}
	//validated user permission
	if !checkUserPermission(user.Username,projectName){
		build.Ctx.Output.ContentType("application/json")
		build.Ctx.WriteString("You have right to import images,permisson deny!")
		build.Ctx.Output.Context.ResponseWriter.Flush()
		build.Ctx.Output.SetStatus(http.StatusUnauthorized)
		return
	}
	build.userName=user.Username
	var buf bytes.Buffer
	buf.WriteString(host_url)
	buf.WriteString("/images/create?fromImage=")
	buf.WriteString(imageName)
	beego.Debug("imgUrl=====" + buf.String())
	client := &http.Client{}
	req, _ := http.NewRequest("POST", buf.String(), nil)
	req.Header.Set("Content-Type", "application/json")
	resp, err := client.Do(req)
	if err == nil{
		defer resp.Body.Close()
	}
	if resp.StatusCode == 200{
		outPutResult(resp.Body,build)
		tagImages(imageName,projectName, build)
	}else{
		//build.RenderError(http.StatusInternalServerError, "import image error!")
		outPutResult(resp.Body,build)
		//return
	}
}

func tagImages(imageName string,projectName string,build *ImagesAPI) {
	fullName := imageName[strings.Index(imageName, "/") + 1:len(imageName)]
	beego.Debug("fullName=====" + fullName)
	var repoName, imagesName, imgFullName, tag string
	if strings.Contains(fullName, "/") {
		repoName = strings.Split(fullName, "/")[0]
		imagesName = strings.Split(fullName, "/")[1]
	} else {
		imagesName = strings.Split(fullName, "/")[0]
	}
	beego.Debug("repoName=====" + repoName)
	beego.Debug("imagesName=====" + imagesName)
	var nameBuf bytes.Buffer
	nameBuf.WriteString(harbor_reg_url)
	nameBuf.WriteString("/")
	nameBuf.WriteString(projectName)
	nameBuf.WriteString("/")
	if strings.Contains(imagesName, ":") && len(imagesName) > 0 {
		imgFullName = nameBuf.String() + strings.Split(imagesName, ":")[0]
		beego.Debug("imgFullName=====" + imgFullName)
		tag = strings.Split(imagesName, ":")[1]
		beego.Debug("tag=====" + tag)
	} else {
		imgFullName = nameBuf.String() + strings.Split(imagesName, ":")[0]
		beego.Debug("imgFullName=====" + imgFullName)
		tag = "latest"
	}
	imageInfo := getImageInfo(imageName)
	var data map[string]interface{}
	var imageId string
	if err := json.Unmarshal([]byte(imageInfo), &data); err == nil {
		imageId = data["Id"].(string)
		imageId = imageId[strings.Index(imageId, ":") + 1:strings.Index(imageId, ":") + 13]
	}
	var tagBuf bytes.Buffer
	tagBuf.WriteString(host_url)
	tagBuf.WriteString("/images/")
	tagBuf.WriteString(imageId)
	tagBuf.WriteString("/tag?repo=")
	tagBuf.WriteString(imgFullName)
	tagBuf.WriteString("&tag=")
	tagBuf.WriteString(tag)
	beego.Debug("tagUrl=====" + tagBuf.String())
	client := &http.Client{}
	req, _ := http.NewRequest("POST", tagBuf.String(), nil)
	req.Header.Set("Content-Type", "application/json")
	resp, err := client.Do(req)
	if err == nil{
		defer resp.Body.Close()
	}
	outPutResult(resp.Body,build)
	pushImage(imgFullName, tag, imageId, build)

}

func getProjectNameById(projectId int64, build *ImagesAPI) string {
	p, err := dao.GetProjectByID(projectId)
	if err != nil {
		log.Errorf("Error occurred in GetProjectById, error: %v", err)
		build.CustomAbort(http.StatusInternalServerError, "Internal error.")
		return ""
	}
	if p == nil {
		log.Warningf("Project with Id: %d does not exist", projectId)
		build.RenderError(http.StatusNotFound, "")
		return ""
	}
	projectName := p.Name
	return projectName
}

func getImageInfo(repoName string) string {
	var imgBuf bytes.Buffer
	imgBuf.WriteString(host_url)
	imgBuf.WriteString("/images/")
	imgBuf.WriteString(repoName)
	imgBuf.WriteString("/json")
	client := &http.Client{}
	req, _ := http.NewRequest("GET", imgBuf.String(), nil)
	req.Header.Set("Content-Type", "application/json")
	resp, _ := client.Do(req)
	defer resp.Body.Close()
	data, _ := ioutil.ReadAll(resp.Body)
	return string(data)
}

func base64UrlEncode(b []byte) string {
	return base64.URLEncoding.EncodeToString(b)
}

func outPutResult(body io.ReadCloser,build *ImagesAPI){
	rb := bufio.NewReaderSize(body,512)
	for {
		line,_,err := rb.ReadLine()
		if err == io.EOF{
			break
		}else{
			var outline string
			if strings.Contains(string(line),"\"}"){
				outline =strings.Replace(string(line),"\"}","\"}\n",-1)
				beego.Debug("line====="+string(line)+"\n")
			}
			build.Ctx.Output.ContentType("application/json")
			build.Ctx.WriteString(outline)
			build.Ctx.Output.Context.ResponseWriter.Flush()
		}
	}
}

func checkUserPermission(userName string,projectName string) bool{
	permission, err := dao.GetPermission(userName, projectName)
	if err != nil {
		log.Errorf("Error occurred in GetPermission: %v", err)
		return false
	}
	if strings.Contains(permission, "W"){
		return true
	}else{
		return false;
	}
}