import AWS from 'aws-sdk'
import { createError } from '../middleware/error-handler'

export class AWSConfig {
  private static s3Instance: AWS.S3
  private static cloudFrontInstance: AWS.CloudFront

  static get s3(): AWS.S3 {
    if (!this.s3Instance) {
      this.s3Instance = new AWS.S3({
        region: process.env.AWS_REGION || 'us-east-1',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        signatureVersion: 'v4',
      })
    }
    return this.s3Instance
  }

  static get cloudFront(): AWS.CloudFront {
    if (!this.cloudFrontInstance) {
      this.cloudFrontInstance = new AWS.CloudFront({
        region: process.env.AWS_REGION || 'us-east-1',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      })
    }
    return this.cloudFrontInstance
  }

  static get bucketName(): string {
    const bucket = process.env.AWS_S3_BUCKET
    if (!bucket) {
      throw createError('AWS S3 bucket name not configured', 500, 'AWS_CONFIG_ERROR')
    }
    return bucket
  }

  static get cloudFrontDomain(): string {
    return process.env.AWS_CLOUDFRONT_DOMAIN || `${this.bucketName}.s3.amazonaws.com`
  }

  static validateConfig(): void {
    const requiredEnvVars = [
      'AWS_REGION',
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY',
      'AWS_S3_BUCKET',
    ]

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName])

    if (missingVars.length > 0) {
      throw createError(
        `Missing required AWS environment variables: ${missingVars.join(', ')}`,
        500,
        'AWS_CONFIG_MISSING'
      )
    }
  }

  static generatePresignedUrl(key: string, expiresIn = 3600): string {
    return this.s3.getSignedUrl('getObject', {
      Bucket: this.bucketName,
      Key: key,
      Expires: expiresIn,
    })
  }

  static generateUploadPresignedUrl(
    key: string,
    contentType: string,
    expiresIn = 900
  ): { uploadUrl: string; fields: any } {
    const params = {
      Bucket: this.bucketName,
      Key: key,
      Expires: expiresIn,
      ContentType: contentType,
      Conditions: [
        ['content-length-range', 0, 50 * 1024 * 1024], // 50MB max
        ['starts-with', '$Content-Type', contentType.split('/')[0]],
      ],
    }

    const presignedPost = this.s3.createPresignedPost(params)
    return {
      uploadUrl: presignedPost.url,
      fields: presignedPost.fields,
    }
  }
}