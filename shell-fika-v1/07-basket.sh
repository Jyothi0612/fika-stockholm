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

dnf install python3.14 python3.14-pip -y &>> $logs_file
validate $? "Installing python 3.14" 

d fika &>> $logs_file
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

curl -L -o /tmp/basket.tar.gz https://github.com/Jyothi0612/fika-stockholm/releases/latest/download/basket.tar.gz &>> $logs_file
validate $? "Downloading basket"

cd /app
tar -xzf /tmp/basket.tar.gz &>> $logs_file
validate $? "Extracting basket"

python3.14 -m venv /app/.venv
validate $? "Creating visrual environemnt"

/app/.venv/bin/pip install -r requirements.txt &>> $logs_file
validate $? "Installing dependencies"

sed -i "s/DOMAIN_NAME/$domain_name/g" "$scripts_dir/basket.service"
cp "$scripts_dir/basket.service" /etc/systemd/system/basket.service

systemctl daemon-reload &>> $logs_file
systemctl enable basket &>> $logs_file
systemctl restart basket &>> $logs_file
validate $? "Starting/Restarting basket"

echo "$(timestamp) [INFO] Script completed in $SECONDS seconds"
echo "$(timestamp) [INFO] ==== Script completed execution ====" | tee -a $logs_file