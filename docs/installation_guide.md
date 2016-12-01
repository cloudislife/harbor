# Installation and Configuration Guide
Harbor can be installed in one of two ways:  

1. From source code - This goes through a full build process, _and requires an Internet connection_.
2. Pre-built installation package - This can save time (no building necessary!) as well as allows for installation on a host that is _not_ connected to the Internet.

This guide describes both of these approaches.

In addition, the deployment instructions on Kubernetes has been created by the community. Refer to [Deploy Harbor on Kubernetes](kubernetes_deployment.md) for details.

## Prerequisites for the target host
Harbor is deployed as several Docker containers, and, therefore, can be deployed on any Linux distribution that supports Docker. 
The target host requires Python, Docker, and Docker Compose to be installed.  
* Python should be version 2.7 or higher.  Note that you may have to install Python on Linux distributions (Gentoo, Arch) that do not come with a Python interpreter installed by default  
* Docker engine should be version 1.10 or higher.  For installation instructions, please refer to: https://docs.docker.com/engine/installation/
* Docker Compose needs to be version 1.6.0 or higher.  For installation instructions, please refer to: https://docs.docker.com/compose/install/

## Installation from source code

_Note: To install from source, the target host must be connected to the Internet!_
The steps boil down to the following

1. Get the source code
2. Configure **harbor.cfg**
3. **prepare** the configuration files
4. Start Harbor with Docker Compose

#### Getting the source code:

```sh
$ git clone https://github.com/vmware/harbor
```
    
#### Configuring Harbor
Configuration parameters are located in the file **harbor.cfg**. 
The parameters are described below - note that at the very least, you will need to change the **hostname** attribute. 

* **hostname**: The target host's hostname, which is used to access the UI and the registry service. It should be the IP address or the fully qualified domain name (FQDN) of your target machine, e.g., `192.168.1.10` or `reg.yourdomain.com`. _Do NOT use `localhost` or `127.0.0.1` for the hostname - the registry service needs to be accessible by external clients!_ 
* **ui_url_protocol**: (**http** or **https**.  Default is **http**) The protocol used to access the UI and the token/notification service.  By default, this is _http_. To set up the https protocol, refer to [Configuring Harbor with HTTPS Access](configure_https.md).  
* **Email settings**: These parameters are needed for Harbor to be able to send a user a "password reset" email, and are only necessary if that functionality is needed.  Also, do note that by default SSL connectivity is _not_ enabled - if your SMTP server requires SSL, but does _not_ support STARTTLS, then you should enable SSL by setting **email_ssl = true**.
	* email_server = smtp.mydomain.com 
	* email_server_port = 25
	* email_username = sample_admin@mydomain.com
	* email_password = abc
	* email_from = admin <sample_admin@mydomain.com>  
	* email_ssl = false

* **harbor_admin_password**: The adminstrator's password. _Note that the default username/password are **admin/Harbor12345** ._  
* **auth_mode**: The type of authentication that is used. By default it is **db_auth**, i.e. the credentials are stored in a database. For LDAP authentication, set this to **ldap_auth**.  
* **ldap_url**: The LDAP endpoint URL (e.g. `ldaps://ldap.mydomain.com`).  _Only used when **auth_mode** is set to *ldap_auth* ._    
* **ldap_basedn**: The basedn template for verifying the user's credential against an LDAP (e.g. `uid=%s,ou=people,dc=mydomain,dc=com` ) or an AD (e.g. `CN=%s,OU=Dept1,DC=mydomain,DC=com`) server.  _Only used when **auth_mode** is set to *ldap_auth* ._ 
* **db_password**: The root password for the mySQL database used for **db_auth**. _Change this password for any production use!_ 
* **self_registration**: (**on** or **off**. Default is **on**) Enable / Disable the ability for a user to register themselves. When disabled, new users can only be created by the Admin user, only an admin user can create new users in Harbor.  _NOTE: When **auth_mode** is set to **ldap_auth**, self-registration feature is **always** disabled, and this flag is ignored._  
* **use_compressed_js**: (**on** or **off**. Default is **on**) For production use, turn this flag to **on**. In development mode, set it to **off** so that js files can be modified separately.
* **max_job_workers**: (default value is **3**) The maximum number of replication workers in job service. For each image replication job, a worker synchronizes all tags of a repository to the remote destination. Increasing this number allows more concurrent replication jobs in the system. However, since each worker consumes a certain amount of network/CPU/IO resources, please carefully pick the value of this attribute based on the hardware resource of the host. 
* **verify_remote_cert**: (**on** or **off**.  Default is **on**) This flag determines whether or not to verify SSL/TLS certificate when Harbor communicates with a remote registry instance. Setting this attribute to **off** will bypass the SSL/TLS verification, which is often used when the remote instance has a self-signed or untrusted certificate.
* **customize_crt**: (**on** or **off**.  Default is **on**) When this attribute is **on**, the prepare script creates private key and root certificate for the generation/verification of the regitry's token.  The following attributes:**crt_country**, **crt_state**, **crt_location**, **crt_organization**, **crt_organizationalunit**, **crt_commonname**, **crt_email** are used as parameters for generating the keys. Set this attribute to **off** when the key and root certificate are supplied by external sources. Refer to [Customize Key and Certificate of Harbor Token Service](customize_token_service.md) for more info.

#### Configuring storage backend (optional)

By default, Harbor stores images on your local filesystem. In a production environment, you may consider 
using other storage backend instead of the local filesystem, like S3, Openstack Swift, Ceph, etc. 
What you need to update is the section of `storage` in the file `Deploy/templates/registry/config.yml`. 
For example, if you use Openstack Swift as your storage backend, the section may look like this:

```
storage:
  swift:
    username: admin
    password: ADMIN_PASS
    authurl: http://keystone_addr:35357/v3
    tenant: admin
    domain: default
    region: regionOne
    container: docker_images
```

_NOTE: For detailed information on storage backend of a registry, refer to [Registry Configuration Reference](https://docs.docker.com/registry/configuration/) ._


#### Building and starting Harbor
Once **harbord.cfg** and storage backend (optional) are configured, build and start Harbor as follows.  Note that the docker-compose process can take a while.  

```sh
    $ cd Deploy
    
    $ ./prepare
    Generated configuration file: ./config/ui/env
    Generated configuration file: ./config/ui/app.conf
    Generated configuration file: ./config/registry/config.yml
    Generated configuration file: ./config/db/env
    Generated configuration file: ./config/jobservice/env
    Clearing the configuration file: ./config/ui/private_key.pem
    Clearing the configuration file: ./config/registry/root.crt
    Generated configuration file: ./config/ui/private_key.pem
    Generated configuration file: ./config/registry/root.crt
    The configuration files are ready, please use docker-compose to start the service.

    $ sudo docker-compose up -d
```

_If everything worked properly, you should be able to open a browser to visit the admin portal at http://reg.yourdomain.com . Note that the default administrator username/password are admin/Harbor12345 ._

Log in to the admin portal and create a new project, e.g. `myproject`. You can then use docker commands to login and push images (By default, the registry server listens on port 80):
```sh
$ docker login reg.yourdomain.com
$ docker push reg.yourdomain.com/myproject/myrepo
```
**NOTE:** The default installation of Harbor uses _HTTP_ - as such, you will need to add the option `--insecure-registry` to your client's Docker daemon and restart the Docker service. 

For information on how to use Harbor, please refer to [User Guide of Harbor](user_guide.md) .

#### Configuring Harbor with HTTPS access
Harbor does not ship with any certificates, and, by default, uses HTTP to serve requests. While this makes it relatively simple to set up and run - especially for a development or testing environment - it is **not** recommended for a production environment.  To enable HTTPS, please refer to [Configuring Harbor with HTTPS Access](configure_https.md).  


## Installation from a pre-built package 

Pre-built installation packages of each release are available at [release page](https://github.com/vmware/harbor/releases). 
Download the package file **harbor-&lt;version&gt;.tgz** , and then extract the files.  
```
$ tar -xzvf harbor-0.3.0.tgz
$ cd harbor
```

Next, configure Harbor as described earlier in [Configuring Harbor](#configuring-harbor). 

Finally, run the **prepare** script to generate config files, and use docker compose to build and start Harbor.


```
$ ./prepare
Generated configuration file: ./config/ui/env
Generated configuration file: ./config/ui/app.conf
Generated configuration file: ./config/registry/config.yml
Generated configuration file: ./config/db/env
Generated configuration file: ./config/jobservice/env
Clearing the configuration file: ./config/ui/private_key.pem
Clearing the configuration file: ./config/registry/root.crt
Generated configuration file: ./config/ui/private_key.pem
Generated configuration file: ./config/registry/root.crt
The configuration files are ready, please use docker-compose to start the service.

$ sudo docker-compose up -d
......
```

### Deploying Harbor on a host which does not have Internet access
*docker-compose up* pulls the base images from Docker Hub and builds new images for the containers, which, necessarily, requires Internet access. To deploy Harbor on a host that is not connected to the Internet:  

1. Prepare Harbor on a machine that has access to the Internet. 
2. Export the images as tgz files
3. Transfer them to the target host. 
4. Load the tgz file into Docker's local image repo on the host.

These steps are detailed below:

#### Building and saving images for offline installation
On a machine that is connected to the Internet,  

1. Extract the files from the pre-built installation package. 
2. Then, run `docker-compose build` to build the images.
3. Use the script `save_image.sh` to export these images as tar files.   Note that the tar files will be stored in the `images/` directory. 
4. Package everything in the directory `harbor/` into a tgz file
5. Transfer this tgz file to the target machine. 

The commands, in detail, are as follows:

```
$ cd harbor
$ sudo docker-compose build
......
$ sudo ./save_image.sh  
saving the image of harbor_ui
finished saving the image of harbor_ui
saving the image of harbor_log
finished saving the image of harbor_log
saving the image of harbor_mysql
finished saving the image of harbor_mysql
saving the image of nginx
finished saving the image of nginx
saving the image of registry
finished saving the image of registry
saving the image of harbor_jobservice
finished saving the image of harbor_jobservice
$ cd ../  
$ tar -cvzf harbor_offline-0.3.0.tgz harbor
```

The file `harbor_offline-0.3.0.tgz` contains the images and other files required to start Harbor.  You can use tools such as `rsync` or `scp` to transfer this file to the target host. 
On the target host, execute the following commands to start Harbor. _Note that before running the **prepare** script, you **must** update **harbor.cfg** to reflect the right configuration of the target machine!_ (Refer to Section [Configuring Harbor](#configuring-harbor)).

```
$ tar -xzvf harbor_offline-0.3.0.tgz  
$ cd harbor  

# load images save by excute ./save_image.sh
$ ./load_image.sh
loading the image of harbor_ui
finish loaded the image of harbor_ui
loading the image of harbor_mysql
finished loading the image of harbor_mysql
loading the image of nginx
finished loading the image of nginx
loading the image of registry
finished loading the image of registry
loading the image of harbor_jobservice
finished loading the image of harbor_jobservice

# Make update to the parameters in ./harbor.cfg  
$ ./prepare
Generated configuration file: ./config/ui/env
Generated configuration file: ./config/ui/app.conf
Generated configuration file: ./config/registry/config.yml
Generated configuration file: ./config/db/env
The configuration files are ready, please use docker-compose to start the service.

# Build the images and then start the services
$ sudo docker-compose up -d
```

### Managing Harbor's lifecycle
You can use docker-compose to manage the lifecycle of the containers. A few useful commands are listed below: 

*Build and start Harbor:*  
```
$ sudo docker-compose up -d 
Creating harbor_log_1
Creating harbor_mysql_1
Creating harbor_registry_1
Creating harbor_ui_1
Creating harbor_proxy_1
Creating harbor_jobservice_1
```  
*Stop Harbor:*
```
$ sudo docker-compose stop
Stopping harbor_proxy_1 ... done
Stopping harbor_ui_1 ... done
Stopping harbor_registry_1 ... done
Stopping harbor_mysql_1 ... done
Stopping harbor_log_1 ... done
Stopping harbor_jobservice_1 ... done
```  
*Restart Harbor after stopping:*
```
$ sudo docker-compose start
Starting harbor_log_1
Starting harbor_mysql_1
Starting harbor_registry_1
Starting harbor_ui_1
Starting harbor_proxy_1
Starting harbor_jobservice_1
```  
*Remove Harbor's containers while keeping the image data and Harbor's database files on the file system:*
```
$ sudo docker-compose rm
Going to remove harbor_proxy_1, harbor_ui_1, harbor_registry_1, harbor_mysql_1, harbor_log_1, harbor_jobservice_1
Are you sure? [yN] y
Removing harbor_proxy_1 ... done
Removing harbor_ui_1 ... done
Removing harbor_registry_1 ... done
Removing harbor_mysql_1 ... done
Removing harbor_log_1 ... done
Removing harbor_jobservice_1 ... done
```  

*Remove Harbor's database and image data (for a clean re-installation):*
```sh
$ rm -r /data/database
$ rm -r /data/registry
```

Please check the [Docker Compose command-line reference](https://docs.docker.com/compose/reference/) for more on docker-compose.

### Persistent data and log files
By default, registry data is persisted in the target host's `/data/` directory.  This data remains unchanged even when Harbor's containers are removed and/or recreated.
In addition, Harbor uses `rsyslog` to collect the logs of each container. By default, these log files are stored in the directory `/var/log/harbor/` on the target host.  

## Configuring Harbor listening on a customized port
By default, Harbor listens on port 80(HTTP) and 443(HTTPS, if configured) for both admin portal and docker commands, you can configure it with a customized one.  

### For HTTP protocol

1.Modify Deploy/docker-compose.yml  
Replace the first "80" to a customized port, e.g. 8888:80.  

```
proxy:
    image: library/nginx:1.9
    restart: always
    volumes:
      - ./config/nginx:/etc/nginx
    ports:
      - 8888:80
      - 443:443
    depends_on:
      - mysql
      - registry
      - ui
      - log
    logging:
      driver: "syslog"
      options:  
        syslog-address: "tcp://127.0.0.1:1514"
        tag: "proxy"
```

2.Modify Deploy/templates/registry/config.yml  
Add the customized port, e.g. ":8888", after "$ui_url".  

```  
auth:
  token:
    issuer: registry-token-issuer
    realm: $ui_url:8888/service/token
    rootcertbundle: /etc/registry/root.crt
    service: token-service
```

3.Execute Deploy/prepare script and start/restart Harbor.  
```sh
$ cd Deploy
$ ./prepare
# If Harbor has already been installed, shutdown it first:
$ docker-compose down
$ docker-compose up -d
```
### For HTTPS protocol
1.Enable HTTPS in Harbor by following this [guide](https://github.com/vmware/harbor/blob/master/docs/configure_https.md).  
2.Modify Deploy/docker-compose.yml  
Replace the first "443" to a customized port, e.g. 4443:443.  

```
proxy:
    image: library/nginx:1.9
    restart: always
    volumes:
      - ./config/nginx:/etc/nginx
    ports:
      - 80:80
      - 4443:443
    depends_on:
      - mysql
      - registry
      - ui
      - log
    logging:
      driver: "syslog"
      options:  
        syslog-address: "tcp://127.0.0.1:1514"
        tag: "proxy"
```

3.Modify Deploy/templates/registry/config.yml  
Add the customized port, e.g. ":4443", after "$ui_url".  

```  
auth:
  token:
    issuer: registry-token-issuer
    realm: $ui_url:4443/service/token
    rootcertbundle: /etc/registry/root.crt
    service: token-service
```

4.Execute Deploy/prepare script and start/restart Harbor.  
```sh
$ cd Deploy
$ ./prepare
# If Harbor has already been installed, shutdown it first:
$ docker-compose down
$ docker-compose up -d
```

## Troubleshooting
1.When setting up Harbor behind an nginx proxy or elastic load balancing, look for the line below, in `Deploy/config/nginx/nginx.conf` and remove it from the sections if the proxy already has similar settings: `location /`, `location /v2/` and `location /service/`.
```
proxy_set_header X-Forwarded-Proto $scheme;
```
