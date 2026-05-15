import fs from 'node:fs'
import { google } from 'googleapis'

function getDrive(authClient) {
  return google.drive({ version: 'v3', auth: authClient })
}

async function findAppDataFile(authClient, filename) {
  const drive = getDrive(authClient)
  const res = await drive.files.list({
    spaces: 'appDataFolder',
    q: `name = '${filename.replace(/'/g, "\\'")}'`,
    fields: 'files(id)',
    pageSize: 1,
  })
  return res.data.files?.[0]?.id ?? null
}

export async function getAppDataFile(authClient, filename) {
  const fileId = await findAppDataFile(authClient, filename)
  if (!fileId) return null
  const drive = getDrive(authClient)
  const res = await drive.files.get({ fileId, alt: 'media' })
  return typeof res.data === 'string' ? res.data : JSON.stringify(res.data)
}

export async function upsertAppDataFile(authClient, filename, content) {
  const drive = getDrive(authClient)
  const media = { mimeType: 'application/json', body: content }
  const existingId = await findAppDataFile(authClient, filename)
  if (existingId) {
    await drive.files.update({ fileId: existingId, media })
  } else {
    await drive.files.create({
      requestBody: { name: filename, parents: ['appDataFolder'] },
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
