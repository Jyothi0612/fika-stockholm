#!/bin/bash

user_id=$(id -u)
logs_folder="/var/log/fika"
logs_file="${logs_folder}/${0}.log"
R="\e[31m"
G="\e[32m"
Y="\e[33m"
N="\e[0m"


# Root check: root's user ID is always 0.
# This script installs packages and edits /etc, which needs root,
# so stop early with a clear message instead of failing halfway.
if [ $user_id -ne 0 ]; then
    echo "Please run this script with sudo access"
    exit 1
fi

# Create the log folder. -p = no error if it already exists (safe to re-run)
mkdir -p $logs_folder

# Current date and time, e.g. 2026-10-23 14:05:33 (%F = date, %T = time).
# Used at the start of every log line so we know when each step ran.
timestamp(){
    date "+%F %T"
}

# Check whether the previous command worked.
# $1 = exit status of that command ($?): 0 = success, anything else = failure
# $2 = description of the step, shown in the message
# On failure: log the error and stop, so later steps don't run on a broken setup.
# tee -a = show on screen AND append to the log file.
validate(){
    if [ $1 -ne 0 ]; then
        echo -e "$(timestamp) [ERROR] ${2}..${R}FAILED${N}" | tee -a $logs_file
        exit 1
    else 
        echo -e "$(timestamp) [INFO] ${2}..${G}SUCCESS${N}" | tee -a $logs_file
    fi
}

dnf module disable redis -y &>> $logs_file
dnf module enable redis:7 -y &>> $logs_file
dnf install redis -y &>> $logs_file
validate $? "Enable and Install redis"

sed -i -e 's/^bind 127.0.0.1/bind 0.0.0.0/' -e 's/^protected-mode yes/protected-mode no/' /etc/redis/redis.conf &>> $logs_file
validate $? "Allowing remote connections to redis"

systemctl enable redis
systemctl start redis
validate $? "Enable and start Redis service"

echo "$(timestamp) [INFO] Script completed in $SECONDS seconds"
echo "$(timestamp) [INFO] ==== Script completed execution ====" | tee -a $logs_file