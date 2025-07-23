#!/usr/bin/env node
/**
 * The main entry point for the application.
 * This file initializes the application and starts the server.
 * It requires the necessary modules and sets up the environment.
 */

import express from 'express';

const app = express()

const PORT = process.env.PORT || 3000

app.use(express.json())

app.get("/", (req, res) => {
    return res.send({
        success: true,
        message: "Welcome to ITFY Backend Server",
        version: "1.0.0"
    })
})


app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)
    console.log(`API URL: http://localhost:${PORT}`)
})