#!/bin/bash

ami_id="ami-0055977a6e828a4f4"
instance_type="t3.micro"
domain_name="agenticengg.online"
hosted_zone_id="Z09464412E06R977EX6SZ"

for instance in $@
do
    echo "Processing: fika-$instance"

    # NEW: does it already exist? (running, pending or stopped)
    instance_id=$(aws ec2 describe-instances \
        --filters "Name=tag:Name,Values=fika-$instance" "Name=instance-state-name,Values=pending,running,stopped" \
        --query "Reservations[0].Instances[0].InstanceId" \
        --output text)

    if [ "$instance_id" != "None" ] && [ -n "$instance_id" ]; then
        echo "fika-$instance already exists: $instance_id - skipping create"
        aws ec2 start-instances --instance-ids $instance_id 
    else
        instance_id=$(aws ec2 run-instances \
            --image-id $ami_id \
            --instance-type $instance_type \
            --security-groups "fika-ssh" "fika-$instance" \
            --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=fika-$instance}]" \
            --query "Instances[0].InstanceId" \
            --output text)

        # NEW: stop if create failed
        if [ $? -ne 0 ] || [ -z "$instance_id" ]; then
            echo "Failed to create fika-$instance - stopping"
            exit 1
        fi
        echo "Created fika-$instance: $instance_id"
    fi

    # NEW: wait until it really exists and is running
    aws ec2 wait instance-running --instance-ids $instance_id

    if [ "$instance" != "frontend" ]; then
        IP=$(aws ec2 describe-instances \
            --instance-ids $instance_id \
            --query "Reservations[0].Instances[0].PrivateIpAddress" \
            --output text)
        r53_record="$instance.fika.$domain_name"      # NEW: .fika. like the docs
    else
        IP=$(aws ec2 describe-instances \
            --instance-ids $instance_id \
            --query "Reservations[0].Instances[0].PublicIpAddress" \
            --output text)
        r53_record="fika.$domain_name"                 # NEW: not the bare domain
    fi

    # NEW: never send an empty IP to Route 53
    if [ -z "$IP" ] || [ "$IP" == "None" ]; then
        echo "Could not get IP for fika-$instance - stopping"
        exit 1
    fi

    aws route53 change-resource-record-sets \
        --hosted-zone-id $hosted_zone_id \
        --change-batch '{
            "Changes": [
                {
                    "Action": "UPSERT",
                    "ResourceRecordSet": {
                    "Name": "'$r53_record'",
                    "Type": "A",
                    "TTL": 1,
                    "ResourceRecords": [
                        {
                        "Value": "'$IP'"
                        }
                    ]
                    }
                }
            ]
        }'

    # NEW: only say "updated" if it worked
    if [ $? -ne 0 ]; then
        echo "Failed to update $r53_record - stopping"
        exit 1
    fi
    echo "$r53_record -> $IP"
done