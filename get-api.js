export const config = {
  runtime: 'edge',
}

export default async function (req) {
  const url = new URL(req.url)
  const action = url.searchParams.get('a')
  const user = url.searchParams.get('u')

  const CLIENT_ID = process.env.TWITCH_CLIENT_ID
  const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET

  async function getToken() {
    if (!CLIENT_ID || !CLIENT_SECRET) {
      throw new Error('Missing TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET')
    }
    const res = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      body: `client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&grant_type=client_credentials`
    })
    const data = await res.json()
    return data.access_token
  }

  try {
    const token = await getToken()
    
    if (action === 'u') {
      const res = await fetch(`https://api.twitch.tv/helix/users?login=${user}`, {
        headers: { 'Client-ID': CLIENT_ID, 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      return new Response(JSON.stringify(data.data?.[0] || null), {
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    if (action === 's') {
      const res = await fetch(`https://api.twitch.tv/helix/streams?user_login=${user}`, {
        headers: { 'Client-ID': CLIENT_ID, 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      return new Response(JSON.stringify({ live: !!data.data?.length }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    return new Response('{"e":"bad"}', { status: 400 })
  } catch (e) {
    return new Response(`{"e":"${e.message}"}`, { status: 500 })
  }
}
