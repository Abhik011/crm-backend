import AWS from "aws-sdk";

// 🔥 CONFIG (runs once)
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();

// ✅ UPLOAD FILE
export const uploadFile = async ({ file, folder = "uploads", companyId }) => {
  if (!file) throw new Error("No file provided");

  const key = `${folder}/${companyId}/${Date.now()}-${file.originalname}`;

  const result = await s3
    .upload({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
     
    })
    .promise();

  return {
    url: result.Location,
    key,
  };
};

// ✅ DELETE FILE
export const deleteFile = async (url) => {
  try {
    if (!url) return;

    const key = url.split(".amazonaws.com/")[1];
    if (!key) return;

    await s3
      .deleteObject({
        Bucket: process.env.S3_BUCKET,
        Key: key,
      })
      .promise();
  } catch (err) {
    console.error("S3 delete error:", err.message);
  }
};