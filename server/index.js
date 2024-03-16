import { redisHost, redisPort, pgUser, pgHost, pgDatabase, pgPassword, pgPort } from "./keys.js";
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import redis from "redis";
import pkg from "pg";

// Express
const app = express();

app.use(cors());
app.use(bodyParser.json());

// Postgres
const { Pool } = pkg;
const pgClient = new Pool({
    user: pgUser,
    host: pgHost,
    database: pgDatabase,
    password: pgPassword,
    port: pgPort,
    ssl: process.env.NODE_ENV !== "production" ? false : { rejectUnauthorized: false }
});

pgClient.on("connect", (client) => {
    client
        .query("CREATE TABLE IF NOT EXISTS values (number INT)")
        .catch((err) => console.error(err));
});

// Redis
const redisClient = redis.createClient({
    host: redisHost,
    port: redisPort,
    retry_strategy: () => 1000
});

const redisPublisher = redisClient.duplicate();

app.get("/", (req, res) => {
    res.send("Hi");
});

app.get("/values/all", async (req, res) => {
    const values = await pgClient.query("SELECT * FROM values");
    res.send(values.rows);
});

app.get("/values/current", async (req, res) => {
    redisClient.hgetall("values", (err, values) => {
        res.send(values);
    });
});

app.post("/values", async (req, res) => {
    const index = req.body.index;

    if (parseInt(index) > 40) {
        return res.status(422).send("Index too high");
    }

    redisClient.hset("values", index, "Nothing yet!");
    redisPublisher.publish("insert", index);
    pgClient.query("INSERT INTO values VALUES ($1)", [index]);

    res.send({
        working: true
    });
});

app.listen(5000, err => {
    console.log("Listening");
});