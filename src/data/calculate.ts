import dayjs from 'dayjs'
import { isEqual, isEmpty, pick } from 'lodash'
import { getDate } from './utils'
import { regionInAppPurchasesTextMap } from 'appinfo.config'

const timeStorageAppInfoFields = ['price', 'formattedPrice', 'inAppPurchases']

function getPrice(priceStr: string) {
  const regexp = /[^0-9]*([0-9]+(\.[0-9]+)?)[^0-9]*/
  let [full, numberStr] = priceStr.match(regexp) || [, '-1']
  const price = parseFloat(numberStr)
  return price
}

export function getDiscountInfo(
  region: Region,
  newAppInfo: AppInfo,
  oldAppInfo?: AppInfo,
) {
  const { price, formattedPrice, inAppPurchases } = newAppInfo

  const discounts: Discount[] = []

  if (isEmpty(oldAppInfo)) {
    return discounts
  }

  const {
    price: oldPrice,
    formattedPrice: oldFormattedPrice,
    inAppPurchases: oldInAppPurchases,
  } = oldAppInfo

  if (oldPrice > price) {
    discounts.push({
      type: 'price',
      // TODO i18n
      typeName: '应用价格',
      name: '价格',
      from: oldFormattedPrice,
      to: formattedPrice,
    })
  }

  Object.entries(inAppPurchases).forEach(([name, formattedPrice]) => {
    const oldFormattedPrice = oldInAppPurchases[name]
    if (oldFormattedPrice) {
      const oldPrice = getPrice(oldFormattedPrice)
      const price = getPrice(formattedPrice)

      if (oldPrice != -1 && price != -1 && oldPrice > price) {
        discounts.push({
          type: 'inAppPurchase',
          typeName: regionInAppPurchasesTextMap[region],
          name,
          from: oldFormattedPrice,
          to: formattedPrice,
        })
      }
    }
  })

  return discounts
}

export default function calculateLatestAppInfo(
  timestamp: number,
  regions: Region[],
  regionAppInfo: RegionAppInfo,
  regionStorageAppInfo: RegionStorageAppInfo,
) {
  const regionDiscountInfo = {}

  for (let i = 0; i < regions.length; i++) {
    const region = regions[i]
    const appInfos = regionAppInfo[region] || []
    const date = getDate(timestamp)
    const discountInfos: DiscountInfo[] = []

    if (appInfos.length > 0) {
      const storageAppInfo = regionStorageAppInfo[region]

      appInfos.forEach((appInfo) => {
        const { trackId } = appInfo
        const dateStorageAppInfo = storageAppInfo[trackId] || []
        const timeStorageAppInfo = dateStorageAppInfo[0] || []
        const oldAppInfo = timeStorageAppInfo[0]
        const newAppInfo: TimeStorageAppInfo = {
          timestamp,
          ...(pick(appInfo, timeStorageAppInfoFields) as Omit<
            TimeStorageAppInfo,
            'timestamp'
          >),
        }

        if (!oldAppInfo) {
          timeStorageAppInfo.unshift(newAppInfo)
          dateStorageAppInfo.unshift(timeStorageAppInfo)
        } else {
          const oldDate = getDate(oldAppInfo.timestamp)
          if (oldDate === date) {
            if (
              !isEqual(
                pick(oldAppInfo, timeStorageAppInfoFields),
                pick(newAppInfo, timeStorageAppInfoFields),
              )
            ) {
              timeStorageAppInfo.unshift(newAppInfo)
            }
          } else {
            dateStorageAppInfo.unshift([newAppInfo])
          }
          // TODO 这里可以计算出价格是否有变化
          /**
           * 1. 如果是新的一天，先判断价格，如果是免费，则加入提醒
           * 2. 否则判断今天是否已存在当前app的提醒
           *    如果存在提醒:
           *        判断是否是价格变化
           *        判断是否是内购价格变化
           */
          // TODO 合并重复的信息

          discountInfos.push({
            ...appInfo,
            timestamp,
            discounts: [
              {
                type: 'price',
                typeName: '价格',
                name: '价格',
                from: '￥100',
                to: '￥2',
              },
              {
                type: 'inAppPurchase',
                typeName: regionInAppPurchasesTextMap[region],
                name: '连续包月 SVIP',
                from: '￥99',
                to: '￥50',
              },
              {
                type: 'inAppPurchase',
                typeName: regionInAppPurchasesTextMap[region],
                name: '年度 SVIP',
                from: '￥99',
                to: '￥0',
              },
            ],
          })
        }

        storageAppInfo[trackId] = dateStorageAppInfo
      })
    }

    regionDiscountInfo[region] = discountInfos
  }

  return regionDiscountInfo as RegionDiscountInfo
}
