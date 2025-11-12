/**
 * Image types for story and interaction images
 */
export interface StoryImage {
    id: string;
    story_id: string;
    transcript_id: string | null;
    storage_path: string;
    thumbnail_path?: string | null;
    file_name: string;
    file_size: number;
    mime_type: string;
    width: number | null;
    height: number | null;
    order_index: number;
    is_primary: boolean;
    source_type: 'transcript' | 'comment';
    source_interaction_id: string | null;
    uploaded_by: string;
    created_at: Date;
    updated_at: Date;
    url?: string;
    thumbnail_url?: string;
    description_i18n?: Record<string, string>;
    copyright_verified?: boolean;
}
export interface InteractionImage {
    id: string;
    interaction_id: string;
    storage_path: string;
    thumbnail_path?: string | null;
    file_name: string;
    file_size: number;
    mime_type: string;
    width: number | null;
    height: number | null;
    order_index: number;
    uploaded_by: string;
    created_at: Date;
    updated_at: Date;
    url?: string;
    thumbnail_url?: string;
    description_i18n?: Record<string, string>;
    copyright_verified?: boolean;
}
export interface ImageUploadRequest {
    file: File;
    transcript_id?: string;
    interaction_id?: string;
}
export interface ImageUploadResponse {
    image: StoryImage | InteractionImage;
    url: string;
}
export interface ImageReorderRequest {
    image_ids: string[];
}
export interface SetPrimaryImageRequest {
    image_id: string;
}
export interface CopyImagesFromCommentRequest {
    interaction_image_ids: string[];
}
export interface CopyImagesFromCommentResponse {
    images: StoryImage[];
}
export declare const IMAGE_VALIDATION: {
    readonly MAX_FILE_SIZE: number;
    readonly MAX_IMAGES_PER_TRANSCRIPT: 6;
    readonly MAX_IMAGES_PER_INTERACTION: 6;
    readonly SUPPORTED_FORMATS: readonly ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
    readonly SUPPORTED_EXTENSIONS: readonly ["jpg", "jpeg", "png", "gif", "webp"];
    readonly COMPRESSION_THRESHOLD: number;
    readonly COMPRESSION_QUALITY: 0.8;
};
export type ImageUploadError = 'INVALID_FORMAT' | 'FILE_TOO_LARGE' | 'TOO_MANY_IMAGES' | 'UPLOAD_FAILED' | 'PERMISSION_DENIED' | 'INVALID_REQUEST';
export interface ImageError {
    code: ImageUploadError;
    message: string;
    details?: string;
}
//# sourceMappingURL=image.d.ts.map