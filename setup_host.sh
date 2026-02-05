sudo apt update
sudo apt install -y \
  qemu-kvm libvirt-daemon-system libvirt-clients \
  virtinst bridge-utils virt-manager
sudo usermod -aG libvirt,kvm $USER
sudo snap install multipass