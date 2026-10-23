#!/bin/bash

user_id=$(id -u)
logs_folder="/var/log/fika"
logs_file="${logs_folder}/${0}.log"
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

dnf module enable mysql:8.4 -y &>> $logs_file
dnf install mysql-server -y &>> $logs_file
validate $? "Installing mysql server"

systemctl enable mysqld &>> $logs_file
systemctl start mysqld &>> $logs_file
validate $? "Enable and start mysql service"

mysql -u root -pFika@1 -e "SELECT 1" &>> $logs_file
if [ $? -ne 0 ]; then
    mysql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED BY 'Fika@1';"
    validate $? "Setting MySQL root password"
else
    echo -e "$(timestamp) [INFO] Root password already set...${Y}SKIPPING${N}" | tee -a $logs_file
fi

curl -L -o /tmp/mysql-data.tar.gz https://github.com/Jyothi0612/fika-stockholm/releases/latest/download/mysql-data.tar.gz &>> $logs_file
validate $? "Downloading MySQL data"

mkdir -p /tmp/fika-db && tar -xzf /tmp/mysql-data.tar.gz -C /tmp/fika-db
validate $? "Extracting MySQL data"

mysql -u root -pFika@1 < /tmp/fika-db/stockholm.sql &>> $logs_file
validate $? "Loading Stockholm districts"

mysql -u root -pFika@1 < /tmp/fika-db/app-user.sql &>> $logs_file
validate $? "Creating delivery app user"

echo "$(timestamp) [INFO] Script completed in $SECONDS seconds"
echo "$(timestamp) [INFO] ==== Script completed execution ====" | tee -a $logs_file