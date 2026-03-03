output "public_ip" {
  value = aws_eip.sezar_eip.public_ip
}

output "s3_bucket_name" {
  value = aws_s3_bucket.photos.id
}

output "ssh_command" {
  value = "ssh -i ${var.key_name}.pem ubuntu@${aws_eip.sezar_eip.public_ip}"
}

output "domain_endpoint" {
  value = var.domain_name
}
