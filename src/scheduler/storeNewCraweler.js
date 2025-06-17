import axios from "axios";
import fs from "fs";
import {sendMail} from "../api/sendMail.js";
import {sendMessage} from "../api/doorayWebHook.js";


const DEFAULT_PAGE_COUNT = 2000;

const DATA_CHANGE_HISTORY_COLUMN_INFO = [
    { key: 'CHNG_DT', name: '변경일자' },
    { key: 'CHNG_BF_CN', name: '변경 전 정보' },
    { key: 'CHNG_AF_CN', name: '변경 후 정보' },
    { key: 'TELNO', name: '전화번호' },
];

const createChangeHistoryTableStr = (changeList) => {
    let tableStr = '<table>';

    // set column
    tableStr += '<tr>';
    DATA_CHANGE_HISTORY_COLUMN_INFO.forEach((info) => {
        tableStr += `<th scope="col" style="width: 25%; height: 50px; text-align: center; border: 1px solid #000;">${info.name}</th>`;
    });
    tableStr += '</tr>';

    // set data
    changeList.forEach((change) => {
        tableStr += '<tr>';
        DATA_CHANGE_HISTORY_COLUMN_INFO.forEach((info) => {
            tableStr += `<td scope="col" style="width: 25%; height: 50px; text-align: center; border: 1px solid #000;">${change[info.key]}</td>`;
        });
        tableStr += '</tr>';
    });

    tableStr += '</table>';
    return tableStr
}

/**
 * rowList
 * [
 *      { LCNS_NO(인허가번호), BSSH_NM(업체명), INDUTY_CD_NM(업종), PRSDNT_NM(대표자), SITE_ADDR(소재지), CLSBIZ_DVS_CD_NM(영업상태), changeList: [
 *          { CHNG_DT(변경일자), CHNG_BF_CN(변경 전 정보), CHNG_AF_CN(변경 후 정보), TELNO(전화번호)}
 *      ]}
 * ]
 * @returns {string}
 */
const makeHTMLData = (dateString, findTotalCount, rowList) => {
    let htmlStr = '<!DOCTYPE html><html lang="ko"><head><title>인허가 변경 정보</title></head><body>';
    if (Array.isArray(rowList) && rowList.length > 0) {
        htmlStr += `<h1>정보 수집 날짜: ${dateString} 전체 확인한 가게수: ${findTotalCount}, 수집한 가게수: ${rowList.length.toLocaleString()}</h1>`;
        htmlStr += '<ol>';
        rowList.forEach((row) => {
            htmlStr += `<li>
                <h3>인허가번호:${row.LCNS_NO}, 사업체명: ${row.BSSH_NM}</h3>
                <h4>인허가 변경 내역</h4>
                ${createChangeHistoryTableStr(row.changeList)}
            </li>`;
        });
        htmlStr += '</ol>';
    } else {
        htmlStr += '<div>No Data</div>'
    }

    return htmlStr + '</body></html>';
};
const createBodyData = (callPage, s_tx_id, pageIndex) => {
    const body = new FormData();
    body.set('menu_no', 2813);
    body.set('menu_grp', 'MENU_NEW04');
    body.set('menuNm', '업체 검색');
    body.set('copyUrl', 'https://www.foodsafetykorea.go.kr:443/portal/specialinfo/searchInfoCompany.do?menu_grp=MENU_NEW04&menu_no=2813');
    // body.set('mberId', undefined);
    // body.set('mberNo', undefined);
    body.set('favorListCnt', 0);
    body.set('menu_grp', '2813');
    body.set('menu_no', 2813);
    body.set('s_mode', 1);
    body.set('s_opt', 'rstrt'); // 음식점
    body.set('s_sido_cd', 41); // 41- 경기
    // body.set('s_bsn_nm', undefined);
    // body.set('s_lcns_no', undefined);
    body.set('s_opt1', 'N');
    body.set('s_opt2', 'N');
    body.set('s_opt3', 'N');
    // body.set('s_opt4', undefined);
    // body.set('s_keyword', undefined);
    body.set('s_opt5', 'N');
    // body.set('s_opt5_sdt', undefined);
    // body.set('s_opt5_edt', undefined);
    body.set('s_opt6', 1); // 영업상태 1-운영, 2-휴/폐업
    body.set('s_opt7', 'N');
    body.set('s_induty_cd', '104,101,120,121,105');
    body.set('s_order_by', 'reg_dt');
    body.set('s_list_cnt', DEFAULT_PAGE_COUNT); // page count
    body.set('s_page_num', pageIndex); // page index
    // body.set('s_food_truck_yn', undefined);
    // body.set('s_na_yn', undefined);
    // body.set('s_halal_yn', undefined);
    // body.set('s_prsdnt_nm', undefined);
    // body.set('s_dsp_reason', undefined);
    // body.set('s_induty_cd_dsp', undefined);
    body.set('s_tx_id', s_tx_id); // 단독으로의 의미 없는거 같음.
    body.set('callPage', callPage);
    body.set('chk_sido', 41); // 41- 경기
    // body.set('bsn_nm', undefined);
    // body.set('lcns_no', undefined);
    body.set('opt6_1', 1); // 영업상태 1-운영, 2-휴/폐업
    // body.set('chk_sido', '41');
    body.set('upjongOne', 'all');
    body.set('opt6_2', 1);
    // body.set('prsdnt_nm', undefined);

    return body;
}

const sleepFunction = (sec) => {
    return new Promise(res => setTimeout(res, sec * 1000));
}

const MAX_THREAD_COUNT = 50;
let threadCount = 0;

const crawlerChangeStoreInfoV2 = async (callPage) => {
    const fsAxiosInstance = axios.create({
        baseURL: 'https://www.foodsafetykorea.go.kr',
        timeout: 10000
    });

    let callIndex = 1;
    const crawlerDate = new Date();
    await sendMessage(`START TO CRAWER : ${crawlerDate}`);
    const changeStoreList = [];
    const crawlerData = [];
    try {
        // 1. 식품안전나라 브라우져에서 크롤링
        // -. 인허가변경사항이 있는 업체 확인
        let apiCountResponse = await fsAxiosInstance.post(`/ajax/portal/specialinfo/searchBsnListCnt.do?callPage=${callPage}`, createBodyData(callPage, callIndex++, 1), {
            headers: {
                "Content-Type": 'application/x-www-form-urlencoded',
                "referer": 'https://www.foodsafetykorea.go.kr/portal/specialinfo/searchInfoCompany.do',
                "Cookie": `callPage=${callPage}`
            },
        });
        // apiCountResponse.data.s_tx_id, apiCountResponse.data.totCnt
        let apiStoreListResponse;
        console.log(`${crawlerDate.toLocaleDateString()} 날짜 인허가 변경된 가게 정보 수집. CallPage: ${callPage} / 총 ${apiCountResponse.data.totCnt.toLocaleString()} 건 검색할 예정`);
        for (let i = 1;  i * DEFAULT_PAGE_COUNT < apiCountResponse.data.totCnt; i += 100000) {
            apiStoreListResponse = await fsAxiosInstance.post(`/ajax/portal/specialinfo/searchBsnList.do?callPage=${callPage}`, createBodyData(callPage, callIndex++, i), {
                headers: {
                    "Content-Type": 'application/x-www-form-urlencoded',
                    "referer": 'https://www.foodsafetykorea.go.kr/portal/specialinfo/searchInfoCompany.do?menu_grp=MENU_NEW04&menu_no=2813',
                    "Cookie": `callPage=${callPage}`
                },
            });
            let loop = 0;
            // apiStoreListResponse.data.s_tx_id, apiStoreListResponse.data, bsnList
            if (apiStoreListResponse.data?.bsnList?.length > 0) {
                for (let j = 0; j < apiStoreListResponse.data.bsnList.length; j++) {
                    threadCount++;
                    const index = ((i - 1) * DEFAULT_PAGE_COUNT) + j + 1;
                    fsAxiosInstance.get(`https://www.foodsafetykorea.go.kr/potalPopup/fooddanger/bsnInfoDetail.do?bsnLcnsLedgNo=${apiStoreListResponse.data.bsnList[j].BSN_LCNS_LEDG_NO}&callPage=${callPage}`, {
                        headers: {
                            "referer": 'https://www.foodsafetykorea.go.kr/portal/specialinfo/searchInfoCompany.do?menu_grp=MENU_NEW04&menu_no=2813',
                            "Cookie": `callPage=${callPage}`
                        },
                    }).then((apiChangeInfoResponse) => {
                        if (!String(apiChangeInfoResponse.data).includes('인허가변경사항 정보가 없습니다.')) {
                            changeStoreList.push(apiStoreListResponse.data.bsnList[j]);
                            console.log(`FIND ITEM. changeListLength: ${changeStoreList.length}, `);
                            /*
                            apiStoreListResponse.data.bsnList[i].LCNS_NO -> 인허가번호
                            apiStoreListResponse.data.bsnList[i].PRSDNT_NM -> 대표자이름
                            apiStoreListResponse.data.bsnList[i].INDUTY_CD_NM -> 업종
                            apiStoreListResponse.data.bsnList[i].CLSBIZ_DVS_CD_NM -> 영업상태
                            apiStoreListResponse.data.bsnList[i].SITE_ADDR -> 소재지
                         */
                            // if (apiStoreListResponse.data.bsnList[j]?.LCNS_NO) {
                            //     try {
                            //         apiChangeInfoResponse = await fsAxiosInstance.get(`https://openapi.foodsafetykorea.go.kr/api/73f9a4125fc84bba8c0d/I2861/json/1/10/LCNS_NO=${apiStoreListResponse.data.bsnList[j].LCNS_NO}`);
                            //         if (apiChangeInfoResponse.data?.I2861?.row?.length > 0) {
                            //             console.log(`인허가 변경 정보 얻어옴. 인허가번호: ${apiStoreListResponse.data.bsnList[j].LCNS_NO}. 데이터 보관`);
                            //             crawlerData.push({
                            //                 ...apiStoreListResponse.data.bsnList[j],
                            //                 changeList: apiChangeInfoResponse.data?.I2861?.row
                            //             });
                            //         } else {
                            //             await sendMessage(`인허가 변경 정보 없음 확인 필요. 인허가번호: ${apiStoreListResponse.data.bsnList[j].LCNS_NO}`);
                            //         }
                            //     } catch (e) {
                            //         await sendMessage(`인허가 정보 조회 실패. 인허가번호: ${apiStoreListResponse.data.bsnList[j].LCNS_NO}. error: ${e}`);
                            //     }
                            // }
                        }
                    }).catch(async (e) => {
                        console.error(`FAILED TO GET STOCK CHANGE INFO. cause: ${e}`);
                        await sendMessage(`FAILED TO GET STOCK CHANGE INFO. cause: ${e}`);
                    }).finally(() => {
                        threadCount--;
                    });

                    while (threadCount >= MAX_THREAD_COUNT) {
                        console.log(`thread count:${threadCount} / MAX_THREAD_COUNT: ${MAX_THREAD_COUNT}. sleep......`);
                        await sleepFunction(1);
                    }
                }
            } else {
                console.log(`can't find bsnList. index: ${i}, searchIndex: ${i * DEFAULT_PAGE_COUNT}`, apiStoreListResponse.data);
                await sendMessage(`FAILED TO GET STOCK CHANGE INFO. cause: cause: ${JSON.stringify(apiStoreListResponse.data)}`);
                return;
            }
        }

        if (changeStoreList.length > 0) {
            try {
                fs.writeFileSync('./stockChangeList.json', JSON.stringify(changeStoreList));
                await sendMessage(`FINISH SAVE CHANGEINFO. changeListLength: ${changeStoreList.length}`);
            } catch (e) {
                console.error(e);
            }
        } else {
            console.log('FINISH CHANGELIST IS EMPTY', changeStoreList.length);
        }
        console.log('FINISH CRAWLER', new Date());
        await sendMessage(`FINISH TO CRAWER : ${new Date()}`);

        // if (crawlerData.length > 0) {
        //     console.log(`날짜: ${crawlerDate} 검색 개수: ${crawlerData.length} 메일 전송 시작`);
        //     await sendMail(`[경기도] 음식점 인허가 변경 정보. 정보 확인한 날짜: ${crawlerDate}`, makeHTMLData(crawlerDate, apiCountResponse.data.totCnt.toLocaleString(), crawlerData));
        // } else {
        //     console.log(`날짜: ${crawlerDate}. 검색한 데이터 없음.`);
        // }

    } catch (e) {
        const date = new Date();
        await sendMail(`${date.toLocaleString()} 데이터 수집 실패`, `데이터 수집 실패. ${e}`);
        console.error('[crawlerChangeStoreInfo] faield.', e);
    }
}

const crawlerChangeStoreInfo = async (callPage) => {
    const fsAxiosInstance = axios.create({
        baseURL: 'https://www.foodsafetykorea.go.kr',
    });

    let callIndex = 1;
    const crawlerDate = new Date().toLocaleDateString();
    const crawlerData = [];
    try {
        // 1. 식품안전나라 브라우져에서 크롤링
        // 1-1. 총 갯수 확인
        let apiCountResponse = await fsAxiosInstance.post(`/ajax/portal/specialinfo/searchBsnListCnt.do?callPage=${callPage}`, createBodyData(callPage, callIndex++, 1), {
            headers: {
                "Content-Type": 'application/x-www-form-urlencoded',
                "referer": 'https://www.foodsafetykorea.go.kr/portal/specialinfo/searchInfoCompany.do',
                "Cookie": `callPage=${callPage}`
            },
        });
        // apiCountResponse.data.s_tx_id, apiCountResponse.data.totCnt
        let apiStoreListResponse, apiChangeInfoResponse;
        console.log(`${crawlerDate} 날짜 인허가 변경된 가게 정보 수집. 총 ${apiCountResponse.data.totCnt.toLocaleString()} 건 검색할 예정`);
        for (let i = 1;  i * DEFAULT_PAGE_COUNT < apiCountResponse.data.totCnt; i += 1000000) {
            apiStoreListResponse = await fsAxiosInstance.post(`/ajax/portal/specialinfo/searchBsnList.do?callPage=${callPage}`, createBodyData(callPage, callIndex++, i), {
                headers: {
                    "Content-Type": 'application/x-www-form-urlencoded',
                    "referer": 'https://www.foodsafetykorea.go.kr/portal/specialinfo/searchInfoCompany.do',
                    "Cookie": `callPage=${callPage}`
                },
            });
            // apiStoreListResponse.data.s_tx_id, apiStoreListResponse.data, bsnList
            if (apiStoreListResponse.data?.bsnList?.length > 0) {
                for (let j = 0; j < apiStoreListResponse.data.bsnList.length; j++) {
                    /*
                        apiStoreListResponse.data.bsnList[j].LCNS_NO -> 인허가번호
                        apiStoreListResponse.data.bsnList[j].PRSDNT_NM -> 대표자이름
                        apiStoreListResponse.data.bsnList[j].INDUTY_CD_NM -> 업종
                        apiStoreListResponse.data.bsnList[j].CLSBIZ_DVS_CD_NM -> 영업상태
                        apiStoreListResponse.data.bsnList[j].SITE_ADDR -> 소재지
                     */
                    if (apiStoreListResponse.data.bsnList[j]?.LCNS_NO) {
                        apiChangeInfoResponse = await fsAxiosInstance.get(`https://openapi.foodsafetykorea.go.kr/api/73f9a4125fc84bba8c0d/I2861/json/1/10/LCNS_NO=${apiStoreListResponse.data.bsnList[j].LCNS_NO}`);
                        if (apiChangeInfoResponse.data?.I2861?.row?.length > 0) {
                            crawlerData.push({
                                ...apiStoreListResponse.data.bsnList[j],
                                changeList: apiChangeInfoResponse.data?.I2861?.row
                            });
                            console.log(`[${((i - 1) * DEFAULT_PAGE_COUNT) + j + 1} / ${apiCountResponse.data.totCnt}] 인허가번호: ${apiStoreListResponse.data.bsnList[j].LCNS_NO} 변경사항 확인.`);
                        } else {
                            console.log(`[${((i - 1) * DEFAULT_PAGE_COUNT) + j + 1} / ${apiCountResponse.data.totCnt}] 인허가번호: ${apiStoreListResponse.data.bsnList[j].LCNS_NO} 변경사항 없음`);
                        }
                    } else {
                        console.log(`[${((i - 1) * DEFAULT_PAGE_COUNT) + j + 1} / ${apiCountResponse.data.totCnt}] 인허가 정보 없음.`, apiStoreListResponse.data.bsnList[j]);
                    }
                }
            } else {
                console.log(`can't find bsnList. index: ${i}, searchIndex: ${i * DEFAULT_PAGE_COUNT}`);
            }
        }

        if (crawlerData.length > 0) {
            console.log(`날짜: ${crawlerDate} 검색 개수: ${crawlerData.length} 메일 전송 시작`);
            await sendMail(`[경기도] 음식점 인허가 변경 정보. 정보 확인한 날짜: ${crawlerDate}`, makeHTMLData(crawlerDate, apiCountResponse.data.totCnt.toLocaleString(), crawlerData));
        } else {
            console.log(`날짜: ${crawlerDate}. 검색한 데이터 없음.`);
        }

    } catch (e) {
        const date = new Date();
        await sendMail(`${date.toLocaleString()} 데이터 수집 실패`, `데이터 수집 실패. ${e}`);
        console.error('[crawlerChangeStoreInfo] faield.', e);
    }
}

export { crawlerChangeStoreInfo, crawlerChangeStoreInfoV2, makeHTMLData }