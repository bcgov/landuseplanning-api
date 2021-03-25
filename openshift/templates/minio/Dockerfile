FROM minio/minio:latest

COPY ./minio-entrypoint.sh /
RUN ["chmod", "+x", "/minio-entrypoint.sh"]
ENTRYPOINT /minio-entrypoint.sh