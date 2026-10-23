#!/bin/bash

user_id=$(id -u)
logs_folder="/var/log/fika"
logs_file="${logs_folder}/${0}.log"
domain_name="agenticengg.online"
scripts_dir=$( dirname "$(realpath "$0")" )
R="\e[31m"
G="\e[32m"
Y="\e[33m"
N="\e[0m"

if [ $user_id -ne 0 ]; then
    echo "Please run this script with sudo access"
    exit 1
fi

mkdir -p $logs_folder

timestamp() {
    date "+%F %T"
}

validate() {
    if [ $1 -ne 0 ]; then
        echo -e "$(timestamp) [ERROR] ${2}..${R}FAILED${N}" | tee -a $logs_file
        exit 1
    else
        echo -e "$(timestamp) [INFO] ${2}..${G}SUCCESS${N}" | tee -a $logs_file
    fi
}

echo "$(timestamp) [INFO] ==== Script started execution ====" | tee -a $logs_file

dnf module disable nodejs -y &>> $logs_file
dnf module enable nodejs:24 -y &>> $logs_file
dnf install nodejs -y &>> $logs_file
validate $? "Enable and installing nodejs 24"

id fika &>> $logs_file
if [ $? -ne 0 ]; then
    useradd --system --home /app --shell /sbin/nologin --comment "fika system user" fika &>> $logs_file
    validate $? "Creating system user"
else
    echo -e "$(timestamp) [INFO] System user fika already exist...${Y}SKIPPING${N}"
fi

rm -rf /app
validate $? "Removing old code"

mkdir -p /app
validate $? "Creating app directory"

curl -L -o /tmp/menu.tar.gz https://github.com/Jyothi0612/fika-stockholm/releases/latest/download/menu.tar.gz
validate $? "Downloading menu"

cd /app
tar -xzf /tmp/menu.tar.gz &>> $logs_file
validate $? "Extracting menu"

npm install &>> $logs_file
validate $? "Install dependencies"

cp "$scripts_dir/mongo.repo" /etc/yum.repos.d/mongo.repo
validate $? "Adding mongo repo"

dnf install mongodb-mongosh -y &>> $logs_file 
validate $? "Installing mongodb client"

item_count=$(mongosh --host "mongodb.fika.$domain_name" --quiet --eval 'db.getSiblingDB("menu").items.countDocuments()' 2>> $logs_file)
validate $? "Connecting to MongoDB"

if [ "$item_count" -eq 0 ]; then
    mongosh --host "mongodb.fika.$domain_name" </app/db/menu-data.js &>> $logs_file
    validate $? "Loading menu items"
else
    echo -e "$(timestamp) [INFO] Menu items already loaded ($item_count)...${Y}SKIPPING${N}" | tee -a $logs_file
fi

sed -i "s/DOMAIN_NAME/$domain_name/g" "$scripts_dir/menu.service"
cp "$scripts_dir/menu.service" /etc/systemd/system/menu.service

systemctl daemon-reload &>> $logs_file
systemctl enable menu &>> $logs_file
systemctl start menu &>> $logs_file
validate $? "$(timestamp) [INFO] Enable and start menu service"

echo "$(timestamp) [INFO] Script completed in $SECONDS seconds"
echo "$(timestamp) [INFO] ==== Script completed execution ====" | tee -a $logs_file