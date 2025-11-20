const express = require('express');
const app = express();
const port = 3300;

app.use(express.static(__dirname + "/client"));

app.listen(port, () => {
    console.log("Port listening on port " + port);
});