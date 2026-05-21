// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('node:fs', () => ({
  default: { createReadStream: vi.fn(() => ({ pipe: vi.fn() })) },
  createReadStream: vi.fn(() => ({ pipe: vi.fn() })),
}))

vi.mock('googleapis', () => {
  const mockDrive = {
    files: {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    permissions: {
      create: vi.fn(),
    },
  }
  return {
    google: {
      drive: vi.fn().mockReturnValue(mockDrive),
    },
  }
})

let driveService
let mockAuthClient
let mockDriveInstance

beforeEach(async () => {
  vi.resetModules()
  vi.clearAllMocks()
  mockAuthClient = {}
  const { google } = await import('googleapis')
  mockDriveInstance = google.drive()
  driveService = await import('../../src/main/driveService.js')
})

describe('getAppDataFile', () => {
  it('returns null when file does not exist in appDataFolder', async () => {
    mockDriveInstance.files.list.mockResolvedValue({ data: { files: [] } })
    const result = await driveService.getAppDataFile(mockAuthClient, 'projects.json')
    expect(result).toBeNull()
  })

  it('returns file content string when file exists', async () => {
    const fileId = 'file-id-123'
    mockDriveInstance.files.list.mockResolvedValue({ data: { files: [{ id: fileId }] } })
    mockDriveInstance.files.get.mockResolvedValue({ data: '{"updatedAt":1,"projects":[]}' })
    const result = await driveService.getAppDataFile(mockAuthClient, 'projects.json')
    expect(result).toBe('{"updatedAt":1,"projects":[]}')
  })

  it('propagates error when files.list rejects', async () => {
    mockDriveInstance.files.list.mockRejectedValue(new Error('network error'))
    await expect(driveService.getAppDataFile(mockAuthClient, 'projects.json')).rejects.toThrow('network error')
  })
})

describe('upsertAppDataFile', () => {
  it('creates a new file when it does not exist', async () => {
    mockDriveInstance.files.list.mockResolvedValue({ data: { files: [] } })
    mockDriveInstance.files.create.mockResolvedValue({ data: { id: 'new-id' } })
    const result = await driveService.upsertAppDataFile(mockAuthClient, 'projects.json', '{"projects":[]}')
    expect(result).toEqual({ ok: true })
    expect(mockDriveInstance.files.create).toHaveBeenCalledTimes(1)
  })

  it('updates existing file when it already exists', async () => {
    mockDriveInstance.files.list.mockResolvedValue({ data: { files: [{ id: 'existing-id' }] } })
    mockDriveInstance.files.update.mockResolvedValue({ data: { id: 'existing-id' } })
    const result = await driveService.upsertAppDataFile(mockAuthClient, 'projects.json', '{"projects":[]}')
    expect(result).toEqual({ ok: true })
    expect(mockDriveInstance.files.update).toHaveBeenCalledTimes(1)
    expect(mockDriveInstance.files.create).not.toHaveBeenCalled()
  })

  it('propagates error when create rejects', async () => {
    mockDriveInstance.files.list.mockResolvedValue({ data: { files: [] } })
    mockDriveInstance.files.create.mockRejectedValue(new Error('quota exceeded'))
    await expect(driveService.upsertAppDataFile(mockAuthClient, 'projects.json', '{"projects":[]}')).rejects.toThrow('quota exceeded')
  })
})

describe('uploadFile', () => {
  it('uploads file and returns fileId and webViewLink', async () => {
    mockDriveInstance.files.create.mockResolvedValue({
      data: { id: 'uploaded-id', webViewLink: 'https://drive.google.com/file/d/uploaded-id/view' }
    })
    const result = await driveService.uploadFile(mockAuthClient, 'C:\\test\\file.svg', 'file.svg', 'image/svg+xml')
    expect(result).toEqual({
      ok: true,
      fileId: 'uploaded-id',
      webViewLink: 'https://drive.google.com/file/d/uploaded-id/view',
    })
  })

  it('propagates error when files.create rejects', async () => {
    mockDriveInstance.files.create.mockRejectedValue(new Error('upload failed'))
    await expect(driveService.uploadFile(mockAuthClient, 'C:\\test\\file.svg', 'file.svg', 'image/svg+xml')).rejects.toThrow('upload failed')
  })
})

describe('shareFileWithEmail', () => {
  it('creates reader permission for specified email', async () => {
    mockDriveInstance.permissions.create.mockResolvedValue({ data: { id: 'perm-id' } })
    const result = await driveService.shareFileWithEmail(mockAuthClient, 'file-id', 'user@example.com')
    expect(result).toEqual({ ok: true })
    expect(mockDriveInstance.permissions.create).toHaveBeenCalledWith({
      fileId: 'file-id',
      sendNotificationEmail: true,
      requestBody: { role: 'reader', type: 'user', emailAddress: 'user@example.com' },
    })
  })

  it('propagates error when permissions.create rejects', async () => {
    mockDriveInstance.permissions.create.mockRejectedValue(new Error('invalid email'))
    await expect(driveService.shareFileWithEmail(mockAuthClient, 'file-id', 'bad@')).rejects.toThrow('invalid email')
  })
})
