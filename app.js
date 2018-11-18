const express = require('express');
const http = require('http');
const path = require('path');
const proxy = require('express-http-proxy');

var app = express();

app.use('/proxy', proxy('api.simkl.com', {https: true}));
app.use('/sync', proxy('api.simkl.com', {https: true, proxyReqPathResolver: function(req) {
  console.log(req.url);
  return req.url;
}}));
app.use('/oauth', proxy('api.simkl.com', {https: true, preserveHostHdr: false}));
// app.use('/movie', proxy('https://api.apiumando.info'));
app.use(express.static(path.join(__dirname, 'build')));

const port = process.env.PORT || '8080';
app.set('port', port);

const server = http.createServer(app);
server.listen(port, () => console.log(`Running on localhost:${port}`));
