#!/bin/bash

cd ~
cd HudConfig
echo raspberry | sudo -S apt-get install nodejs --assume-yes
echo raspberry | sudo -S apt install npm --assume-yes
echo raspberry | sudo -S npm install request
echo raspberry | sudo -S npm install dateformat
echo raspberry | sudo -S npm install express
echo raspberry | sudo -S npm install express-handlebars
echo raspberry | sudo -S npm install detect-rpi
echo raspberry | sudo -S npm install ip
echo raspberry | sudo -S npm install

echo "Run crontab -e"
echo "Add the following line at the bottom if it is not already in the file"
echo "@reboot sudo nodejs /home/pi/HudConfig/src/index.js &"
echo "The save the file"
echo "The config site will be ready on the next reboot"