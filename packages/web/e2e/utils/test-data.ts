// Test data generators and utilities

export interface TestProject {
  id?: string;
  title: string;
  description?: string;
  facilitatorId?: string;
  storytellerId?: string;
}

export interface TestStory {
  id?: string;
  projectId: string;
  title?: string;
  transcript?: string;
  audioUrl?: string;
  status?: 'processing' | 'ready' | 'failed';
}

// Generate test project data
export function generateTestProject(overrides: Partial<TestProject> = {}): TestProject {
  return {
    title: `Test Project ${Date.now()}`,
    description: 'A test project for E2E testing',
    ...overrides,
  };
}

// Generate test story data
export function generateTestStory(projectId: string, overrides: Partial<TestStory> = {}): TestStory {
  return {
    projectId,
    title: `Test Story ${Date.now()}`,
    transcript: 'This is a test story transcript for E2E testing purposes.',
    status: 'ready',
    ...overrides,
  };
}

// API helpers for test data creation
export class TestDataAPI {
  private baseUrl: string;
  private authToken?: string;

  constructor(baseUrl = process.env.API_URL || 'http://localhost:3001') {
    this.baseUrl = baseUrl;
  }

  setAuthToken(token: string) {
    this.authToken = token;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}/api${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async createProject(projectData: TestProject) {
    return this.request('/projects', {
      method: 'POST',
      body: JSON.stringify(projectData),
    });
  }

  async createStory(storyData: TestStory) {
    return this.request(`/projects/${storyData.projectId}/stories`, {
      method: 'POST',
      body: JSON.stringify(storyData),
    });
  }

  async deleteProject(projectId: string) {
    return this.request(`/projects/${projectId}`, {
      method: 'DELETE',
    });
  }

  async deleteStory(storyId: string) {
    return this.request(`/stories/${storyId}`, {
      method: 'DELETE',
    });
  }

  async createInvitation(projectId: string, email: string) {
    return this.request(`/projects/${projectId}/invitation`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }
}

// File upload helpers
export function createTestAudioFile(): File {
  // Create a minimal WAV file for testing
  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);
  
  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 44100, true);
  view.setUint32(28, 88200, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, 0, true);

  return new File([buffer], 'test-audio.wav', { type: 'audio/wav' });
}

export function createTestImageFile(): File {
  // Create a minimal 1x1 PNG for testing
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#FF0000';
  ctx.fillRect(0, 0, 1, 1);
  
  return new Promise<File>((resolve) => {
    canvas.toBlob((blob) => {
      resolve(new File([blob!], 'test-image.png', { type: 'image/png' }));
    });
  }) as any;
}

// Wait helpers
export function waitForElement(page: any, selector: string, timeout = 5000) {
  return page.waitForSelector(selector, { timeout });
}

export function waitForText(page: any, text: string, timeout = 5000) {
  return page.waitForFunction(
    (searchText) => document.body.innerText.includes(searchText),
    text,
    { timeout }
  );
}

// Performance helpers
export async function measurePageLoad(page: any, url: string) {
  const startTime = Date.now();
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  const endTime = Date.now();
  return endTime - startTime;
}

export async function measureAudioUpload(page: any, audioFile: File) {
  const startTime = Date.now();
  
  // Upload the file
  await page.setInputFiles('[data-testid="audio-upload"]', audioFile);
  
  // Wait for upload completion
  await page.waitForSelector('[data-testid="upload-success"]', { timeout: 30000 });
  
  const endTime = Date.now();
  return endTime - startTime;
}