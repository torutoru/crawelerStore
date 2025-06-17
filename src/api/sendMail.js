import nodemailer from 'nodemailer';
import fs from "fs";
import Const from "../const.js";

const transporter = nodemailer.createTransport({
   service: 'gmail',
   auth: {
       user: 'cwwin77@gmail.com',
       pass: 'iwix jnov gefa ltdn'
   }
});

const sendMail = async (title, htmlBody, sendFileName) => {
    await transporter.sendMail({
        from: 'cw_developer@dev.com',
        to: 'omararai@naver.com',
        // to: 'flymnmn@naver.com',
        subject: title,
        html: htmlBody,
        attachments: sendFileName ? [ { filename: `${sendFileName}`, content: fs.createReadStream( `${Const.FILE_BASE_PATH}/output/${sendFileName}`)} ] : undefined
    }, (error, info) => {
        if (error) {
            console.error('[SEND MAIL] FAILED cause:', error);
        } else {
            console.log('[SEND MAIL] OK. title:' + title);
        }
    })
};

export { sendMail }