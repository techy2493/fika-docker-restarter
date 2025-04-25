require('dotenv').config()
const express = require('express')
const { exec } = require('child_process')
const crypto = require('crypto')

const app = express()
const port = process.env.PORT || 8125
const REQUIRED_PASSWORD = process.env.RESTART_UI_PASSWORD || 'techyiscool'
const CONTAINER_HEADLESS = process.env.CONTAINER_HEADLESS || 'fika_headless'
const CONTAINER_SERVER = process.env.CONTAINER_SERVER || 'fika-server'

// In-memory store for job statuses and outputs
const jobs = {}

app.use(express.urlencoded({ extended: true }))
app.use(express.json())

// replace newlines with HTML <br> tags
function htmlify(text) {
  return text.replace(/\r?\n/g, '<br>')
}

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Restart Containers</title>
</head>
<body style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:1em;">
  <p style="font-style:italic;">Restarts may take a minute or two.</p>
  <input type="password" id="password" placeholder="Password" required style="padding:0.5em;font-size:1em;"/>
  <div style="display:flex;gap:1em;">
    <button id="restart-headless" style="padding:1em 2em;font-size:1.1em;">Restart Headless</button>
    <button id="full-restart" style="padding:1em 2em;font-size:1.1em;">Full Restart</button>
  </div>
  <div id="output" style="white-space:pre-wrap;max-width:600px;text-align:left;"></div>
  <script>
    const outputDiv = document.getElementById('output')
    const CONTAINER_HEADLESS = '${CONTAINER_HEADLESS}'
    const CONTAINER_SERVER = '${CONTAINER_SERVER}'

    async function doRestart(action) {
      const password = document.getElementById('password').value
      const resp = await fetch('/restart', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({password, action})
      })
      if (!resp.ok) {
        outputDiv.innerHTML = 'Error: ' + await resp.text()
        return
      }
      const {jobId} = await resp.json()
      outputDiv.innerHTML = 'Restart initiated (job ' + jobId + ').<br>Checking status every 30 seconds...'
      const interval = setInterval(async () => {
        const statusResp = await fetch('/status?jobId=' + jobId)
        if (!statusResp.ok) {
          outputDiv.innerHTML = 'Status error: ' + await statusResp.text()
          clearInterval(interval)
          return
        }
        const {status, output} = await statusResp.json()
        if (status === 'running') {
          outputDiv.innerHTML = 'Restart in progress...'
        } else {
          clearInterval(interval)
          outputDiv.innerHTML = output
        }
      }, 30000)
    }

    document.getElementById('restart-headless')
      .addEventListener('click', () => doRestart(CONTAINER_HEADLESS))
    document.getElementById('full-restart')
      .addEventListener('click', () => doRestart(CONTAINER_SERVER))
  </script>
</body>
</html>`)
})

app.post('/restart', (req, res) => {
  const {password, action} = req.body
  if (password !== REQUIRED_PASSWORD) {
    return res.status(401).send('Unauthorized')
  }

  const jobId = crypto.randomBytes(16).toString('hex')
  jobs[jobId] = {status:'running', output:''}
  res.json({jobId})

  if (action === CONTAINER_HEADLESS) {
    exec(`docker restart ${CONTAINER_HEADLESS}`, (err, stdout, stderr) => {
      const raw = err
        ? 'Error: failed to restart headless:\n' + stderr
        : 'Success: headless restarted:\n' + stdout
      jobs[jobId] = {status: err ? 'error' : 'done', output: htmlify(raw)}
    })

  } else if (action === CONTAINER_SERVER) {
    exec(`docker restart ${CONTAINER_SERVER}`, (err1, stdout1, stderr1) => {
      if (err1) {
        jobs[jobId] = {status:'error', output: htmlify('Error: failed to restart server:\n' + stderr1)}
        return
      }
      setTimeout(() => {
        exec(`docker restart ${CONTAINER_HEADLESS}`, (err2, stdout2, stderr2) => {
          const raw = err2
            ? 'Success: server restarted:\n' + stdout1 + '\n\nError: failed to restart headless:\n' + stderr2
            : 'Success: server restarted:\n' + stdout1 + '\n\nSuccess: headless restarted:\n' + stdout2
          jobs[jobId] = {
            status: err2 ? 'error' : 'done',
            output: htmlify(raw)
          }
        })
      }, 30000)
    })

  } else {
    jobs[jobId] = {status:'error', output: htmlify('Unknown action')}
  }
})

app.get('/status', (req, res) => {
  const job = jobs[req.query.jobId]
  if (!job) {
    return res.status(404).send('Unknown job ID')
  }
  res.json(job)
})

app.listen(port, () => {
  console.log('Server running at http://localhost:' + port)
})
