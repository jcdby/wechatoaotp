const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { init: initDB } = require("./db");
const sha1 = require("sha1");
const axios = require("axios");
const parseString = require("xml2js").parseString;

const logger = morgan("tiny");

const app = express();
let accessToken;
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cors());
app.use(logger);

// 首页
app.get("/", async (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/check", (req, res) => {
  const signature = req.query.signature;
  const timestamp = req.query.timestamp;
  const nonce = req.query.nonce;

  const token = "123abc";
  const temp = [token, timestamp, nonce].sort().join("");

  const tmpStr = sha1(temp);
  if (tmpStr === signature) {
    res.send(req.query.echostr);
  } else {
    res.send("error");
  }
});

app.post("/check", (req, res) => {
  const data = req.body;
  let xmlData;

  req
    .on("data", (data) => {
      const xml = data.toString();
      parseString(xml, (err, result) => {
        if (err) {
          console.log(err);
        } else {
          console.log(result);
          xmlData = result;
        }
      });
    })
    .on("end", () => {
      const receiveMsg = xmlData;
      const FromUserName = receiveMsg.xml.FromUserName[0];
      const ToUserName = receiveMsg.xml.ToUserName[0];
      const MsgType = receiveMsg.xml.MsgType[0];
      const Event = receiveMsg.xml.Event[0];

      let replyContent = "这是后台回复的内容";

      if (MsgType === "event" && Event === "SCAN") {
        console.log(Event);
        replyContent = "验证码是 123456";

      }
      console.log(FromUserName, ToUserName);
      let responseMsg = `<xml>
                                <ToUserName><![CDATA[${FromUserName}]]></ToUserName>
                                <FromUserName><![CDATA[${ToUserName}]]></FromUserName>
                                <CreateTime>${new Date().getTime()}</CreateTime>
                                <MsgType><![CDATA[text]]></MsgType>
                                <Content><![CDATA[${replyContent}]]></Content>
                            </xml>`;;
      console.log(responseMsg);
      res.send(responseMsg);
    });
});

// 获取二维码数据
app.get("/qrcode", (req, res) => {
  const sceneId = req.query.sceneId;
  const body = {
    expire_seconds: 604800,
    action_name: "QR_STR_SCENE",
    action_info: {
      scene: {
        scene_str: sceneId,
      },
    },
  };
  axios
    .post(
      `https://api.weixin.qq.com/cgi-bin/qrcode/create?access_token=${accessToken}`,
      body
    )
    .then((res) => {
      return res.data;
    })
    .then((data) => {
      res.send(data);
    })
    .catch((err) => {
      console.log(err);
    });
});

app.get("/opt-verity", (req, res) => {
  const code = req.query.code;
  if (code === "123456") {
    res.send("验证成功");
  } else {
    res.send("验证失败");
  }
});

// 小程序调用，获取微信 Open ID
app.get("/api/wx_openid", async (req, res) => {
  if (req.headers["x-wx-source"]) {
    res.send(req.headers["x-wx-openid"]);
  }
});

const port = process.env.PORT || 80;

function getAccessToken() {
  return new Promise((resolve, reject) => {
    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=wxc78155b9d1460d51&secret=abace8fe33145171ec171597ab26c99e`;

    axios
      .get(url)
      .then((res) => {
        console.log(res.data);
        resolve(res.data.access_token);
      })
      .catch((err) => {
        console.log(err);
      });
  });
}

async function bootstrap() {
  await initDB();
  accessToken = await getAccessToken();

  app.listen(port, () => {
    console.log("启动成功", port);
  });
}

bootstrap();
