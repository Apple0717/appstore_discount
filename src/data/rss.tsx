import dayjs from 'dayjs'
import { Feed } from 'feed'
import { writeFileSync } from 'fs'
import { resolve } from 'path'
import { getDate } from './utils'
import React, { render } from 'jsx-to-md'
import { getTranslate } from './i18n'
import { Translate } from 'i18n-pro'
import { regionInAppPurchasesTextMap } from 'appinfo.config'

function getShowDescription(discountInfo: DiscountInfo) {
  const { discounts } = discountInfo

  const { price, inAppPurchase } = discounts.reduce(
    (res, discount) => {
      const { type, name, from, to } = discount
      if (type === 'price') {
        res.price = `${name}: ${from} → ${to}`
      } else {
        res.inAppPurchase.push(`${name}: ${from} → ${to}`)
      }

      return res
    },
    {
      price: '',
      inAppPurchase: [],
    },
  )

  if (price) {
    inAppPurchase.unshift(price)
  }

  return inAppPurchase.join('<br/>')
}

function getShowContent(
  region: Region,
  t: Translate,
  discountInfo: DiscountInfo,
) {
  const {
    discounts,
    trackViewUrl,
    description,
    artworkUrl60,
    screenshotUrls,
    ipadScreenshotUrls,
    appletvScreenshotUrls,
  } = discountInfo

  const discountInfoContent = (() => {
    const { price, inAppPurchase } = discounts.reduce(
      (res, discount) => {
        const { type, name, from, to } = discount
        if (type === 'price') {
          res.price = (
            <>
              <span>{from}</span>
              {` → `}
              <b>
                <strong>{to}</strong>
              </b>
            </>
          )
        } else {
          res.inAppPurchase.push(
            <>
              <strong>{name}：</strong>
              <span>{from}</span>
              {` → `}
              <b>
                <strong>{to}</strong>
              </b>
            </>,
          )
        }

        return res
      },
      {
        price: '' as any,
        inAppPurchase: [],
      },
    )

    return (
      <>
        {price && (
          <>
            <h2>
              {t('优惠信息')}
              {`（${t('价格')}：${render(price)}）`}
            </h2>
          </>
        )}
        {!price && <h2>{t('优惠信息')}</h2>}
        {inAppPurchase.length && (
          <>
            <h3>{regionInAppPurchasesTextMap[region]}</h3>
            <ul>
              {inAppPurchase.map((content) => (
                <li>{content}</li>
              ))}
            </ul>
          </>
        )}
      </>
    )
  })()

  return render(
    <>
      <a href={trackViewUrl}>
        <img src={artworkUrl60} />
      </a>
      {discountInfoContent}
      <h2>{t('应用描述')}</h2>
      <p>{description}</p>
      {(screenshotUrls.length ||
        ipadScreenshotUrls.length ||
        appletvScreenshotUrls.length) && (
        <>
          <h2>{t('应用截屏')}</h2>
          {screenshotUrls.length && (
            <>
              <h3>iPhone</h3>
              {screenshotUrls.map((url) => {
                return <img src={url} />
              })}
            </>
          )}
          {ipadScreenshotUrls.length && (
            <>
              <h3>iPad</h3>
              {ipadScreenshotUrls.map((url) => {
                return <img src={url} />
              })}
            </>
          )}
          {appletvScreenshotUrls.length && (
            <>
              <h3>Apple TV</h3>
              {appletvScreenshotUrls.map((url) => {
                return <img src={url} />
              })}
            </>
          )}
        </>
      )}
    </>,
  )
}

function generateRegionFeed(regionDiscountInfo: RegionDiscountInfo) {
  const appstoreIcon = 'https://s3.bmp.ovh/imgs/2024/07/20/491487aec936222a.png'

  const regionFeed = Object.entries(regionDiscountInfo).reduce(
    (res, [key, discountInfos]) => {
      const region = key as Region
      const t = getTranslate(region)

      const feed = new Feed({
        title: `AppStore Discounts（${region}）`,
        description:
          'AppStore Discounts - Made with love by appstore-discounts(https://github.com/eyelly-wu/appstore-discounts)',
        id: `https://github.com/eyelly-wu/appstore-discounts/rss/${region}.xml`,
        link: `https://apps.apple.com/${region}/app`,
        image: appstoreIcon,
        favicon: appstoreIcon,
        copyright: 'Copyright (c) 2024-present Eyelly Wu',
        updated: new Date(),
        author: {
          name: 'Eyelly wu',
          email: 'eyelly.wu@gmail.com',
          link: 'https://github.com/eyelly-wu',
        },
      })

      discountInfos.forEach((discountInfo) => {
        const { timestamp, trackName, trackViewUrl } = discountInfo

        feed.addItem({
          title: `${trackName}`,
          id: `${trackName}-${timestamp}`,
          link: trackViewUrl,
          description: getShowDescription(discountInfo),
          content: getShowContent(region, t, discountInfo),
          date: new Date(timestamp),
        })
      })

      res[region] = feed.atom1()

      return res
    },
    {},
  )

  return regionFeed as RegionFeed
}

function saveRegionFeed(feeds: RegionFeed) {
  Object.entries(feeds).forEach(([region, feed]) => {
    const filepath = resolve(__dirname, '../../rss', `${region}.xml`)
    writeFileSync(filepath, feed, 'utf-8')
  })
}

export default function updateFeeds(regionDiscountInfo: RegionDiscountInfo) {
  const feed = generateRegionFeed(regionDiscountInfo)
  saveRegionFeed(feed)
}
