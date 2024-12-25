import express, {json} from "express"
import router from "./routes/index.js";

const app = express();

app.use(json());

const PORT = process.env.PORT || 6000;


app.use((req, res, next) => {
    const originalSend = res.send;
    res.send = function (body) {
        if (typeof body === 'object') {
            body = JSON.stringify(body, null, 2); // Pretty-print with 4 spaces
            res.setHeader('Content-Type', 'application/json');
        }
        originalSend.call(this, body);
    };
    next();
});

app.use('/evoting/', router);


app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;