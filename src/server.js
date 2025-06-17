import express from 'express';
import cron from 'node-cron';
import fs from 'fs';
import {crawlerIncidentInfo, crawlerCongestInfo, crawlerAllIncidentInfo} from './scheduler/trafficCrawler.js';
import { crawlerStoreInfo } from "./scheduler/storeInfoCrawler.js";
import {crawlerChangeStoreInfo, crawlerChangeStoreInfoV2} from "./scheduler/storeNewCraweler.js";
import axios from "axios";
import {crawlerStoreOnlyAPI, crawlerStoreUsingFile} from "./scheduler/storeCrawlerOnlyAPI.js";

const PORT = 5000;

const app = express();

const CRONTAB_INFO_INCIDENT = '* 16 * * 1-5'; // 오후 16시
const CRONTAB_INFO_CONGESTINFO = '*/10 16 * * 1-5';
const CRONTAB_INFO_STOCK = '0 9 * * *';
const CRONTAB_INFO_STOCK_API = '0 7 * * 1-5';

const ApiCharacters = 'abcdefghijklmnopqrstuvwxyz0123456789';

let API_KEY_LIST;


const getRandomAPIKEY = () => {
    const array = new Uint8Array(20);
    crypto.getRandomValues(array);

    return Array.from(array, (byte) => ApiCharacters[byte % ApiCharacters.length]).join('');
}

app.get('/get-api-key', async (req, res) => {
    if (req.query.mode) {
        try {
            let response, temp;
            switch (req.query.mode) {
                case 'test':
                    response = await axios.get(`https://openapi.foodsafetykorea.go.kr/api/${API_KEY_LIST[0].key}/I2861/json/1/10`);
                    return res.send(response.data);
                case 'random':
                    temp = API_KEY_LIST[Math.ceil(Math.random() * API_KEY_LIST.length)];
                    response = await axios.get(`https://openapi.foodsafetykorea.go.kr/api/${temp.key}/I2861/json/1/10`);
                    return res.send(`key: ${temp.key}, isAvailable: ${temp.isAvailable}, response_data: ${JSON.stringify(response.data)}`);
                default:
                    return res.send(API_KEY_LIST.filter((apiInfo) => apiInfo.isAvailable));
            }
        } catch (e) {
            console.error(`Failed to param: ${req.query.mode}`, e);
            return res.send();
        }
    } else {
        return res.send(API_KEY_LIST);
    }
});

app.get('/find-api-key', async (req, res) => {
    const loop = req.query.loop || 10;
    let testKey, response;
    for (let i = 0; i < loop; i++) {
        testKey = getRandomAPIKEY();
        console.log(`[${i}] TEST key: ${testKey}`);
        if (!API_KEY_LIST.some((keyInfo) => testKey === keyInfo.key)) {
            try {
                response = await axios.get(`https://openapi.foodsafetykorea.go.kr/api/${testKey}/I2861/json/1/10`);
                console.log(JSON.parse(response.data));
                API_KEY_LIST.push({
                    key: testKey,
                    isAvailable: true,
                });
                console.log('FIND !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!', testKey);
            } catch (e) {
                API_KEY_LIST.push({
                    key: testKey,
                    isAvailable: false,
                });
            }
        } else {
            console.log('TEST KEY is duplicated');
        }
    }

    try {
        console.log('SAVE API KEY', new Date());
        fs.writeFileSync('./apiKeyList.json', JSON.stringify(API_KEY_LIST));
        console.log('SUCCESS SAVE API KEY');
    } catch (e) {
        console.error('FAILED TO SAVE KEY', e);
    }
    // axios.get(`https://openapi.foodsafetykorea.go.kr/api/73f9a4125fc84bba8c01/I2861/json/1/10`)
    return res.send(`${API_KEY_LIST.length}`);
});

app.get('/crawler-stock-change-info', async (req, res) => {
    console.log(req.query.callPage);
    await crawlerChangeStoreInfo(req.query.callPage);
    return res.send();
});

app.get('/start', async (req, res) => {
    crawlerStoreUsingFile();
    return res.send('ok');
});

app.get('/wakeup', async (req, res) => {
    return res.send('ok');
});

app.get('/store_info', async (req, res) => {
    console.log(req.query.date);
    await crawlerStoreInfo(req.query.date);
    console.log('FINISH crawer store info');
    return res.send();
});

app.get('/traffic_info', async (req, res) => {
    console.log('/traffic_info', req.query.mode);
    if (req.query.mode === '0') {
        await crawlerAllIncidentInfo();
    } else if (req.query.mode === '1') {
        await crawlerIncidentInfo();
    } else {
        await crawlerCongestInfo();
    }
    console.log('FINISH traffice crawler info');
    return res.send();
});

app.listen(PORT, async () => {
    // await sendMessage(`교통수집 크롤러 시작.\n [크론텝]\n -. 돌발수집:${CRONTAB_INFO_INCIDENT}\n -. 교통정보수집:${CRONTAB_INFO_CONGESTINFO}`);
    
    // cron.schedule(CRONTAB_INFO_INCIDENT, async () => {
    //     console.log('START crawlerIncidentInfo CRAWLER. TIME:', new Date().toLocaleTimeString());
    //     await crawlerIncidentInfo();
    // });
    //
    // cron.schedule(CRONTAB_INFO_CONGESTINFO, async () => {
    //     console.log('START crawlerAllIncidentInfo CRAWLER. TIME:', new Date().toLocaleTimeString());
    //     await crawlerAllIncidentInfo();
    // });
    //
    // cron.schedule(CRONTAB_INFO_CONGESTINFO, async () => {
    //     console.log('START crawlerCongestInfo CRAWLER. TIME:', new Date().toLocaleTimeString());
    //     await crawlerCongestInfo();
    // });
    //
    // cron.schedule(CRONTAB_INFO_STOCK, async () => {
    //     console.log('START crawlerStoreInfo CRAWLER. TIME:', new Date().toLocaleTimeString());
    //     await crawlerStoreInfo();
    // });
    console.log(`[START] server port: ${PORT}`);
    cron.schedule(CRONTAB_INFO_STOCK_API, async () => {
        console.log('[스케쥴러] START crawlerStoreUsingFile', new Date());
        await crawlerStoreUsingFile();
        console.log('[스케쥴러] FINISH crawlerStoreUsingFile', new Date());
    });
    // try {
    //     console.log('1. START TO LOAD API KEY', new Date());
    //     const data = fs.readFileSync('./apiKeyList.json', 'utf-8');
    //     API_KEY_LIST = JSON.parse(data);
    //     console.log('SUCCESS LOAD API KEY');
    // } catch (e) {
    //     console.error('FAILED TO LOAD API KEY', e);
    // }
});

/*
.close(async () => {
    await sendMessage(Const.ERROR_LEVEL.LOW, '교통수집 크롤러 종료');

    console.log('FINISH SYSTEM');
});

*/