sudo apt update
sudo apt install python3-pip curl

# from the docs https://docs.docker.com/engine/install/ubuntu/
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh ./get-docker.sh

sudo groupadd docker
sudo usermod -aG docker $USER
newgrp docker
docker run hello-world