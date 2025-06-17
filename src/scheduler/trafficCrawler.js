
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import {sendCongestMessage, sendIncidentMessage} from '../api/doorayWebHook.js';

const API_KEY = 'b7e7fc65cdbc7f8ff4940fe504d498e6847ffac';
const GG_API_PATH = 'https://openapigits.gg.go.kr/api/rest';

const parser = new XMLParser();
const axiosInstance = axios.create({
    baseURL: GG_API_PATH,
    params: {
        serviceKey: API_KEY
    }
});

const INCIDENT_SEARCH_KEYWORD = [
    '판교',
    '의왕',
    '청계',
    '신부곡',
    '월암',
    '서수원',
    '호매실',
    '금곡'
];

const C1_ROUTE_INFO = {
    name: '판교역 -> 의왕청계휴게소',
    routeID: 1010001001,
    linkInfoList : [
        { id: 2060011300, from: '판교JC', to: '판교JC남측'},
        { id: 2060010700, from: '판교JC', to: '판교JC남측'},
        { id: 2060011200, from: '판교JC남측', to: '판교JC'},
        { id: 2060010800, from: '판교JC', to: '판교JC'},
        { id: 2260010601, from: '의왕청계휴게소', to: '판교JC'},
        { id: 2260010701, from: '판교JC', to: '의왕청계휴게소'},
        { id: 2060010900, from: '판교JC', to: '판교JC'},
        { id: 2040153200, from: '판교JC', to: '판교역'},
        { id: 2060360800, from: '판교역', to: '판교JC'},
        { id: 2040410000, from: '판교역', to: '판교JC'},
        { id: 2060360700, from: '판교JC', to: '판교역'}
        
    ]
};

const C2_ROUTE_INFO = {
    name: '의왕청계휴게소 -> 호매실IC',
    routeID: 1010001001,
    linkInfoList : [
        { id: 2260004200, from: '의왕IC북측', to: '의왕IC입구'},
        { id: 2260003900, from: '의왕IC북측', to: '의왕IC입구'},
        { id: 2260004400, from: '의왕IC북측', to: '의왕IC남측'},
        { id: 2260002900, from: '신부곡IC북측', to: '신부곡IC 남측'},
        { id: 2260002500, from: '신부곡IC', to: '신부곡IC 남측'},
        { id: 2260002700, from: '신부곡IC북측', to: '신부곡IC남측'},
        { id: 2260000900, from: '신부곡IC남측', to: '월암IC북측'},
        { id: 2260000600, from: '월암IC북측', to: '월암IC남측'},
        { id: 2010006900, from: '서수원IC북측', to: '서수원IC남측'},
        { id: 2010005400, from: '서수원IC남측', to: '호매실IC북측'},
        { id: 2010100000, from: '서수원IC남측', to: '금곡IC'},
        { id: 2010005401, from: '금곡IC', to: '호매실IC북측'},
        { id: 2010004300, from: '호매실IC북측', to: '호매실IC남측'},
        { id: 2010003900, from: '호매실IC북측', to: '호매실IC'},
    ]
};

const checkAllIncidentInfo = async () => {
    let response, bodyData;

    try {
        response = await axiosInstance.get('/getIncidentInfo');
        bodyData = parser.parse(response.data);
        if (bodyData?.ServiceResult?.msgHeader?.itemCount) {
            // 결과 존재
            let msg;
            if (bodyData?.ServiceResult?.msgBody?.itemList instanceof Array) {
                for (let errItem of bodyData?.ServiceResult?.msgBody?.itemList) {
                    msg = '';
                    if (errItem.inciDesc) {
                        msg += `${errItem.inciDesc}\n`;
                    }

                    if (errItem.inciPlace1) {
                        msg += `-. ${errItem.inciPlace1}\n`;
                    }

                    if (errItem.inciPlace2) {
                        msg += `-. ${errItem.inciPlace2}\n`;
                    }
                    if (INCIDENT_SEARCH_KEYWORD.some((keyword) => msg.indexOf(keyword) >= 0)) {
                        await sendIncidentMessage(msg, {
                            title: '구글 지도(링크)',
                            text: '지도로 보기',
                            titleLink: `https://www.google.com/maps?q=${errItem.coord_y},${errItem.coord_x}`
                        });
                    }
                }
            } else {
                msg = '';
                if (bodyData?.ServiceResult?.msgBody?.itemList.inciDesc) {
                    msg += bodyData?.ServiceResult?.msgBody?.itemList.inciDesc + '\n';
                }

                if (bodyData?.ServiceResult?.msgBody?.itemList.inciPlace1) {
                    msg += `-. ${bodyData?.ServiceResult?.msgBody?.itemList.inciPlace1}` + '\n';
                }

                if (bodyData?.ServiceResult?.msgBody?.itemList.inciPlace2) {
                    msg += `-. ${bodyData?.ServiceResult?.msgBody?.itemList.inciPlace2}` + '\n';
                }
                if (INCIDENT_SEARCH_KEYWORD.some((keyword) => msg.indexOf(keyword) >= 0)) {
                    await sendIncidentMessage(msg, {
                        title: '구글 지도(링크)',
                        text: '지도로 보기',
                        titleLink: `https://www.google.com/maps?q=${bodyData?.ServiceResult?.msgBody?.itemList.coord_y},${bodyData?.ServiceResult?.msgBody?.itemList.coord_x}`
                    });
                }
            }
        } else {
            // 결과 미존재
            console.log('[TRAFIC_CRAWLER_AllIncidentInfo] not exists IncidentInfo.');
        }
    } catch (e) {
        console.error('[TRAFIC_CRAWLER_AllIncidentInfo] FAILED IncidentInfo. cause:', e);
    }
};

const checkIncidentInfo = async (infoList) => {

    let response, bodyData;

    for (let item of infoList) {
        try {
            response = await axiosInstance.get('/getIncidentInfo', {
                params: {
                    linkId: item.id
                }
            });
            bodyData = parser.parse(response.data);
            if (bodyData?.ServiceResult?.msgHeader?.itemCount) {
                // 결과 존재
                let msg = `[${item.from} -> ${item.to}]\n`;
                if (bodyData?.ServiceResult?.msgBody?.itemList instanceof Array) {
                    for (let errItem of bodyData?.ServiceResult?.msgBody?.itemList) {
                        if (errItem.inciDesc) {
                            msg += errItem.inciDesc;
                        }

                        if (errItem.inciPlace1) {
                            msg += `- ${errItem.inciPlace1}\n`;
                        }

                        if (errItem.inciPlace2) {
                            msg += `- ${errItem.inciPlace2}\n`;
                        }
                        await sendIncidentMessage(msg, {
                            title: '구글 지도(링크)',
                            text: '지도로 보기',
                            titleLink: `https://www.google.com/maps?q=${errItem.coord_y},${errItem.coord_x}`
                        });
                    }
                } else {
                    if (bodyData?.ServiceResult?.msgBody?.itemList.inciDesc) {
                        msg += bodyData?.ServiceResult?.msgBody?.itemList.inciDesc + '\n';
                    }

                    if (bodyData?.ServiceResult?.msgBody?.itemList.inciPlace1) {
                        msg += `- ${bodyData?.ServiceResult?.msgBody?.itemList.inciPlace1}` + '\n';
                    }

                    if (bodyData?.ServiceResult?.msgBody?.itemList.inciPlace2) {
                        msg += `- ${bodyData?.ServiceResult?.msgBody?.itemList.inciPlace2}` + '\n';
                    }
                    await sendIncidentMessage(msg, {
                        title: '구글 지도(링크)',
                        text: '지도로 보기',
                        titleLink: `https://www.google.com/maps?q=${bodyData?.ServiceResult?.msgBody?.itemList.coord_y},${bodyData?.ServiceResult?.msgBody?.itemList.coord_x}`
                    });
                }
            } else {
                // 결과 미존재
                console.log('[TRAFIC_CRAWLER_checkIncidentInfo] STEP 1. PASS linkId:', item.id, 'from:', item.from, 'to:', item.to);
            }
        } catch (e) {
            console.error('[TRAFIC_CRAWLER_checkIncidentInfo] FAILED STEP 1. linkId:', item.id, 'cause:', e);
        }
    }
}

const checkCongestInfo = async (routeInfo) => {
    let response, bodyData;
    let totalSpeed = 0, totalDelay = 0, totalLevel = 0;

    try {
        for (let item of routeInfo.linkInfoList) {
            response = await axiosInstance.get('/getRoadLinkTrafficInfo', {
                params: {
                    linkId: item.id
                }
            });
            bodyData = parser.parse(response.data);
            if (bodyData?.ServiceResult?.msgHeader?.itemCount) {
                // 결과 존재
                if (bodyData?.ServiceResult?.msgBody?.itemList instanceof Array) {
                    for (let errItem of bodyData?.ServiceResult?.msgBody?.itemList) {
                        if (errItem.spd) {
                            totalSpeed += errItem.spd;
                        }

                        if (typeof errItem.linkDelayTime !== 'undefined') {
                            totalDelay += errItem.linkDelayTime;
                        }

                        totalLevel += errItem.congGrade;
                    }
                } else {
                    if (bodyData?.ServiceResult?.msgBody?.itemList.spd) {
                        totalSpeed += bodyData?.ServiceResult?.msgBody?.itemList.spd;
                    }

                    if (typeof bodyData?.ServiceResult?.msgBody?.itemList.linkDelayTime !== 'undefined') {
                        totalDelay += bodyData?.ServiceResult?.msgBody?.itemList.linkDelayTime;
                    }

                    totalLevel += bodyData?.ServiceResult?.msgBody?.itemList.congGrade;
                }
            } else {
                // 결과 미존재
                console.log('[TRAFIC_CRAWLER_checkCongestInfo] STEP 1. PASS linkId:', item.id, 'from:', item.from, 'to:', item.to);
            }
        }
        await sendCongestMessage(Math.round(totalLevel / routeInfo.linkInfoList.length), `[${routeInfo.name}]\n-. 평균 속도: ${Math.round(totalSpeed / routeInfo.linkInfoList.length)}\n-.평균 지연시간: ${Math.round(totalDelay / routeInfo.linkInfoList.length)}`);
    } catch (e) {
        console.error('[TRAFIC_CRAWLER_checkCongestInfo] FAILED.', routeInfo.name, 'cause:', e);
    }
}

/**
 * 돌발정보 조회 - 제1순환고속도로
 * 
 * 판교 JC <-> 판교JC 남측
 * 판교 JC <-> 의왕청계휴게소
 * 판교 JC <-> 판교역 근처
 */
const crawlerIncidenC1 = async () => {
    // 1. 돌발정보조회
    console.log('[TRAFFIC_CRAWLER] 제1순환고속도로 체크');
    await checkIncidentInfo(C1_ROUTE_INFO.linkInfoList);
};

/**
 * 돌발정보 조회 - 봉담과천로
 */
const crawlerIncidenC2 = async () => {
    // 1. 돌발정보조회
    console.log('[TRAFFIC_CRAWLER] 봉담과천로 체크');
    await checkIncidentInfo(C2_ROUTE_INFO.linkInfoList);
};

const crawlerCongestC1 = async () => {
    // 1. 구간 소통정보 조회
    console.log('[TRAFFIC_CRAWLER] 제1순환고속도로 구간 소통정보 조회');
    await checkCongestInfo(C1_ROUTE_INFO);
};

const crawlerCongestC2 = async () => {
    // 1. 돌발정보조회
    console.log('[TRAFFIC_CRAWLER] 봉담과천로 구간 소통정보 조회');
    await checkCongestInfo(C2_ROUTE_INFO);
};

const crawlerAllIncidentInfo = async () => {
    await checkAllIncidentInfo();
};

/**
 * 돌발정보 조회
 * @returns {Promise<void>}
 */
const crawlerIncidentInfo = async () => {
    await crawlerIncidenC1();
    await crawlerIncidenC2();
};

/**
 * 구간 소통정보 조회
 */
const crawlerCongestInfo = async () => {
    await crawlerCongestC1();
    await crawlerCongestC2();
}

export { crawlerIncidentInfo, crawlerCongestInfo, crawlerAllIncidentInfo }