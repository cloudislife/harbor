# Harbor



<img alt="Harbor" src="docs/img/harbor_logo.png">

Project Harbor is an enterprise-class registry server that stores and distributes Docker images. Harbor extends the open source Docker Distribution by adding the functionalities usually required by an enterprise, such as security, identity and management. As an enterprise private registry, Harbor offers better performance and security. Having a registry closer to the build and run environment improves the image transfer efficiency. Harbor supports the setup of multiple registries and has images replicated between them. With Harbor, the images are stored within the private registry, keeping the bits and intellectual properties behind the company firewall. In addition, Harbor offers advanced security features, such as user management, access control and activity auditing.   

This project is forked from vmware/harbor and customized:
- support online build image
	- user can upload a tar or tar.gz archive compressed,the archive must include a build instructions file, typically called Dockerfile at the archive’s root
- support import image from third hub,like hub.tenxcloud.com or other private registry
- add api to get all public repository 
