import express, {json} from "express"
import router from "./routes/index.js";

const app = express();

app.use(json());

const PORT = process.env.PORT || 6000;

app.use('/evoting/', router);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;