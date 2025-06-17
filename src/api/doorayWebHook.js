import axios from 'axios';
import Const from '../const.js';

const DOORAY_WEBHOOK_URL = 'https://hancom.dooray.com/services/3058063232953031521/3960941846792658079/dItKCNMvTdSOaJjwBRpG4A';

const axiosInstance = axios.create({
    headers: {
        "Content-Type": "application/json"
    }
});

const sendIncidentMessage = async (message, link) => {
    try {
        let attachment
        if (link) {
            attachment = link;
        }
        await axiosInstance.post(DOORAY_WEBHOOK_URL, {
            botName: `알람-돌발정보`,
            botIconImage: 'https://cdn.pixabay.com/photo/2012/04/12/22/25/warning-sign-30915_1280.png',
            text: message,
            attachments: attachment ? [attachment] : undefined
        });
        console.log('[DOORAY_WEBHOOK_sendIncidentMessage] SEND SUCCESS', message);
    } catch (e) {
        console.error('[ERROR][DOORAY_WEBHOOK_sendIncidentMessage] SEND MESSAGE', e);
    }
};

const sendCongestMessage = async (level, message) => {
    switch(level) {
        case Const.ERROR_LEVEL.HIGH:
            message = '[정체] ' + message;
            break;
        case Const.ERROR_LEVEL.MIDDLE:
            message = '[지체] ' + message;
            break;
        case Const.ERROR_LEVEL.LOW:
            message = '[원활] ' + message;
            break;
        default:
            message = '[정보없음]' + message;
            break;
    }

    try {
        await axiosInstance.post(DOORAY_WEBHOOK_URL, {
            botName: `알람-교통정보`,
            botIconImage: 'https://cdn.pixabay.com/photo/2016/06/26/23/32/information-1481584_1280.png',
            text: message,
        });
        console.log('[DOORAY_WEBHOOK_sendCongestMessage] SEND SUCCESS', message);
    } catch (e) {
        console.error('[ERROR][DOORAY_WEBHOOK_sendCongestMessage] SEND MESSAGE', e);
    }
};

const sendMessage = async (message) => {
    try {
        await axiosInstance.post(DOORAY_WEBHOOK_URL, {
            botName: `알람`,
            botIconImage: 'https://cdn.pixabay.com/photo/2015/12/04/22/20/gear-1077550_1280.png',
            text: message,
        });
        console.log('[sendMessage] SEND SUCCESS', message);
    } catch (e) {
        console.error('[ERROR][sendMessage] SEND MESSAGE', e);
    }
}

export { sendMessage, sendIncidentMessage, sendCongestMessage };