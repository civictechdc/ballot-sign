sudo apt update
sudo apt install python3-pip curl

# from the docs https://docs.docker.com/engine/install/ubuntu/
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh ./get-docker.sh

sudo apt-get install -y avahi-daemon
sudo hostnamectl set-hostname ballot-vm
sudo systemctl enable --now avahi-daemon

sudo groupadd docker
sudo usermod -aG docker $USER
newgrp docker
docker run hello-world

pip install -r requirements.txt