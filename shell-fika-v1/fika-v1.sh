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
        aws ec2 start-instances --instance-ids $instance_id > /dev/null   # no-op if already running
    else
        instance_id=$(aws ec2 run-instances \
            --image-id $ami_id \
            --instance-type $instance_type \
            --security-groups "fika-ssh" "fika-$instance" \
            --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=fika-$instance}]" \
            --query "Instances[0].InstanceId" \
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