import axios from "axios";
import { XMLParser } from "fast-xml-parser";
import proj4 from 'proj4';
import {sendMail} from "../api/sendMail.js";

const axiosInstance = axios.create({
    baseURL: 'http://www.localdata.go.kr/platform/rest/GR0/openDataApi',
    params: {
        authKey: '6H5FZ21Sks80onWosYqwQT8WTJ8KvtopQcIbkSjppsI=',
        localCode: '6410000'
    }
});

// TM 중부원점 좌표계 정의 (EPSG:2097 또는 EPSG:5186)
const tmCentral = '+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=500000 +ellps=GRS80 +units=m +no_defs';

// WGS84 좌표계 정의 (EPSG:4326)
const wgs84 = proj4.defs('EPSG:4326');

const xmlParser = new XMLParser();

const STOCK_UPDATE_DESC = {
    'I': '신규생성',
    'D': '삭제',
    'U': '정보업데이트',
};

const DATA_TABLE_COLUMN_INFO = [
    { key: 'bplcNm', name: '사업장명' },
    { key: 'trdStateNm', name: '영업상태' },
    { key: 'rdnWhlAddr', name: '도로명주소' },
    { key: 'updateGbn', name: '업데이트구분' },
    { key: 'updateDt', name: '정보갱신일자' },
    { key: 'apvPermYmd', name: '인허가일자' },
    { key: 'apvCancelYmd', name: '인허가취소일자' },
    { key: 'ropnYmd', name: '재개업일자' },
    { key: 'link', name: '링크' },
];

const getDateString = (date) => {
    return date.getFullYear() + ('0' + (date.getMonth() +  1 )).slice(-2) + ('0' + date.getDate()).slice(-2);
};

const getLinkString = (x, y, name) => {
    const [long, lati] = proj4(tmCentral, wgs84, [x, y]);
    // return `https://www.google.com/maps?q=${lati},${long}`;
    return `https://map.naver.com/p/?lng=${long}&lat=${lati}&level=16&marker=true&title=${name}`;
};

const getMobileLinkString = (x, y, name) => {
    const [long, lati] = proj4(tmCentral, wgs84, [x, y]);
    // return `https://www.google.com/maps?q=${lati},${long}`;
    return `nmap://place?lat=${lati}&lng=${long}&zoom=15&appname=cw&name=${name}`;
}

const makeHtmlData = (rowList) => {
    /**
     * +
     *             '<tr><th >이름</th><th scope="col">나이</th></tr><tr><td>조철우</td><td>16</td></tr></table>'+
     *             '</div></body></html>'
     */
    let htmlStr = '<!DOCTYPE html><html lang="ko"><head><title>정보</title></head><body>';

    if (rowList && rowList.length > 0) {
        htmlStr += '<table style="border-collapse: collapse"><tr>';

        // make table header
        DATA_TABLE_COLUMN_INFO.forEach((item) => {
            htmlStr += `<th scope="col" style="width: 11%; height: 50px; text-align: center; border: 1px solid #000;">${item.name}</th>`;
        });
        htmlStr += '</tr>';

        // make table body
        rowList.forEach((row) => {
            htmlStr += '<tr>';
            DATA_TABLE_COLUMN_INFO.forEach((item) => {
                if (item.key === 'link') {
                    if (row.y && row.x) {
                        htmlStr += `<td style="text-align: center; border: 1px solid #000;">
                                        <br />
                                        <div><a href='${getLinkString(row.x, row.y, row['bplcNm'])}'>웹 전용</a></div>
                                        <br /><br /><br />
                                        <div><a href='${getMobileLinkString(row.x, row.y, row['bplcNm'])}'>모바일 전용</a></div>
                                        <br />
                                    </td>`;
                    } else {
                        htmlStr += `<td style="text-align: center; border: 1px solid #000;"></td>`;
                    }
                } else if (item.key === 'updateGbn') {
                    htmlStr += `<td style="text-align: center; border: 1px solid #000;">${STOCK_UPDATE_DESC[row[item.key]]}</td>`;
                } else {
                    htmlStr += `<td style="text-align: center; border: 1px solid #000;">${row[item.key]}</td>`;
                }
            });
            htmlStr += '</tr>';
        });

    } else {
        htmlStr += '<div>No Data</div>'
    }

    return htmlStr + '</body></html>';
}

/**
 * state - 운영 상태코드
 * 01: 영업/정상
 * 02: 휴업
 * 03: 폐업
 * 04: 취소/말소/만료/정지/중지
 */
const crawlerWithState = async (dateParam) => {
    // date
    const today = new Date();
    const beforeDate = new Date();
    beforeDate.setDate(today.getDate() - 1);

    const searchDate = dateParam || getDateString(beforeDate);

    // page info
    let pageIndex = 1;
    let pageSize = 100;
    let totalDataCount = pageIndex * pageSize;

    do {
        const response = await axiosInstance.get('/', {
            params: {
                pageIndex: pageIndex,
                pageSize: pageSize,
                lastModTsBgn: searchDate,
                lastModTsEnd: searchDate,
            }
        });
        const data = xmlParser.parse(response.data);

        // 페이지 카운팅
        if (data?.result?.header?.paging?.totalCount) {
            totalDataCount = data.result.header.paging.totalCount;
        }

        sendMail(`최종수정일자: ${searchDate} 에 변경된 음식점 정보 - [${pageIndex}]`, makeHtmlData(data?.result?.body?.rows?.row));
        pageIndex++;
    } while (pageIndex * pageSize < totalDataCount);
}

const crawlerStoreInfo = async (date) => {
    try {
        await crawlerWithState(date);
    } catch (e) {
        console.error('[STORE_INFO_CRAWER] failed to crawer. cause', e);
    }
};

export { crawlerStoreInfo }