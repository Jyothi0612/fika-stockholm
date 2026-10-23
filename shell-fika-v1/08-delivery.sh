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

dnf module enable maven:3.9 -y
dnf install maven java-25-openjdk-devel -y
validate $? "Install maven and Java"

alternatives --set java "/usr/lib/jvm/java-25-openjdk/bin/java"
validate $? "Setting Java 25 as default Java version"

echo "export JAVA_HOME=$(dirname $(dirname $(readlink -f /usr/bin/java)))" > /etc/profile.d/java.sh
source /etc/profile.d/java.sh
echo $JAVA_HOME
validate $? "Setting JAVA_HOME for maven"

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

curl -L -o /tmp/delivery.tar.gz https://github.com/Jyothi0612/fika-stockholm/releases/latest/download/delivery.tar.gz &>> $logs_file
validate $? "Downloading delivery"

cd /app
tar -xzf /tmp/delivery.tar.gz &>> $logs_file
validate $? "Extracting delivery"

mvn clean package &>> $logs_file
validate $? "Install dependencies"

mv target/delivery.jar delivery.jar
validate $? "Moving delivery.jar file"

sed -i "s/DOMAIN_NAME/$domain_name/g" "$scripts_dir/delivery.service"
cp "$scripts_dir/delivery.service" /etc/systemd/system/delivery.service

systemctl daemon-reload &>> $logs_file
systemctl enable delivery &>> $logs_file
systemctl start delivery &>> $logs_file
validate $? "$(timestamp) [INFO] Enable and start delivery service"

systemctl restart delivery
validate $? "Restarting delivery"

echo "$(timestamp) [INFO] Script completed in $SECONDS seconds"
echo "$(timestamp) [INFO] ==== Script completed execution ====" | tee -a $logs_file