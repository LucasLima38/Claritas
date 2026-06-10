import fs from 'node:fs'
import { google } from 'googleapis'

const CLARITAS_FOLDER_NAME = '.claritas'

function getDrive(authClient) {
  return google.drive({ version: 'v3', auth: authClient })
}

async function findOrCreateClaritasFolder(authClient) {
  const drive = getDrive(authClient)
  const res = await drive.files.list({
    q: `name = '${CLARITAS_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id)',
    pageSize: 1,
    spaces: 'drive',
  })
  if (res.data.files?.[0]?.id) return res.data.files[0].id
  const created = await drive.files.create({
    requestBody: { name: CLARITAS_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' },
    fields: 'id',
  })
  return created.data.id
}

export async function getAppDataFile(authClient, filename) {
  const drive = getDrive(authClient)
  const folderId = await findOrCreateClaritasFolder(authClient)
  const res = await drive.files.list({
    q: `name = '${filename.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed = false`,
    fields: 'files(id)',
    pageSize: 1,
  })
  const fileId = res.data.files?.[0]?.id
  if (!fileId) return null
  const fileRes = await drive.files.get({ fileId, alt: 'media' })
  return typeof fileRes.data === 'string' ? fileRes.data : JSON.stringify(fileRes.data)
}

export async function upsertAppDataFile(authClient, filename, content) {
  const drive = getDrive(authClient)
  const folderId = await findOrCreateClaritasFolder(authClient)
  const media = { mimeType: 'application/json', body: content }
  const res = await drive.files.list({
    q: `name = '${filename.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed = false`,
    fields: 'files(id)',
    pageSize: 1,
  })
  const existingId = res.data.files?.[0]?.id
  if (existingId) {
    await drive.files.update({ fileId: existingId, media })
  } else {
    await drive.files.create({
      requestBody: { name: filename, parents: [folderId] },
      media,
    })
  }
  return { ok: true }
}

export async function uploadFile(authClient, fullPath, filename, mimeType) {
  const drive = getDrive(authClient)
  const res = await drive.files.create({
    requestBody: { name: filename },
    media: { mimeType, body: fs.createReadStream(fullPath) },
    fields: 'id,webViewLink',
  })
  return { ok: true, fileId: res.data.id, webViewLink: res.data.webViewLink }
}

export async function shareFileWithEmail(authClient, fileId, email) {
  const drive = getDrive(authClient)
  await drive.permissions.create({
    fileId,
    sendNotificationEmail: true,
    requestBody: { role: 'reader', type: 'user', emailAddress: email },
  })
  return { ok: true }
}

export async function uploadFileToDriveFolder(authClient, fullPath, filename, mimeType, folderId) {
  const drive = getDrive(authClient)
  const res = await drive.files.create({
    requestBody: { name: filename, parents: [folderId] },
    media: { mimeType, body: fs.createReadStream(fullPath) },
    fields: 'id,webViewLink',
  })
  return { ok: true, fileId: res.data.id, webViewLink: res.data.webViewLink }
}

export async function listDriveFolders(authClient, parentId) {
  const drive = getDrive(authClient)
  const resolvedParent = parentId ?? 'root'
  const parentClause = `'${resolvedParent}' in parents and `
  const q = `${parentClause}mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  const res = await drive.files.list({
    q,
    fields: 'files(id,name,modifiedTime,webViewLink)',
    pageSize: 100,
  })
  return res.data.files ?? []
}

export async function createDriveFolder(authClient, name, parentId) {
  const drive = getDrive(authClient)
  const requestBody = { name, mimeType: 'application/vnd.google-apps.folder' }
  if (parentId) requestBody.parents = [parentId]
  const res = await drive.files.create({
    requestBody,
    fields: 'id,webViewLink',
  })
  return { id: res.data.id, webViewLink: res.data.webViewLink }
}

export async function deleteDriveFolder(authClient, folderId) {
  const drive = getDrive(authClient)
  await drive.files.delete({ fileId: folderId })
  return { ok: true }
}

export async function deleteDriveFile(authClient, fileId) {
  const drive = getDrive(authClient)
  await drive.files.delete({ fileId })
  return { ok: true }
}

export async function shareFolderWithEmail(authClient, folderId, email) {
  const drive = getDrive(authClient)
  await drive.permissions.create({
    fileId: folderId,
    sendNotificationEmail: true,
    requestBody: { role: 'reader', type: 'user', emailAddress: email },
  })
  return { ok: true }
}
