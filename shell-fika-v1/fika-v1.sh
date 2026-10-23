#!/bin/bash

ami_id="ami-0055977a6e828a4f4"
instance_type="t3.micro"
domain_name="agenticengg.online"
hosted_zone_id="Z09464412E06R977EX6SZ"

for instance in $@
do
    echo "Creating instance: $instance"

    instance_id=$(aws ec2 run-instances \
            --image-id $ami_id \
            --instance-type $instance_type \
            --security-groups "fika-ssh" "fika-$instance" \
            --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=fika-$instance}]" \
            --query "Instances[0].InstanceId" \
            --output text
    )

    echo "$instance ID: $instance_id"

    if [ $instance != "frontend" ]; then
        IP=$(aws ec2 describe-instances \
            --instance-ids $instance_id \
            --query "Reservations[*].Instances[*].PrivateIpAddress" \
            --output text
        )
        r53_record="$instance.$domain_name"
    else
        IP=$(aws ec2 describe-instances \
            --instance-ids $instance_id \
            --query "Reservations[*].Instances[*].PublicIpAddress" \
            --output text
        )
        r53_record="$domain_name"
    fi
    
    # update the route53 record

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

        echo "Updated $r53_record for $instance"
done