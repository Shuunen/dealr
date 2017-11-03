const puppeteer = require('puppeteer')

function scroll(page) {
    return page.evaluate(() => {
        return new Promise(resolve => {
            window.scrollTo(0, document.body.scrollHeight)
            setTimeout(() => resolve(), 500)
        })
    })
}

let scrape = async () => {
    const browser = await puppeteer.launch({ headless: false })
    const page = await browser.newPage()

    await page.goto('https://www.dealabs.com/hot')
    await page.waitFor(800)
    await scroll(page)
    await scroll(page)
    await scroll(page)

    let deals = await page.evaluate(() => {
        let elements = document.querySelectorAll('section.thread-list--type-list article.thread.thread--type-list')
        let length = elements.length
        let deals = []
        for (let i = 0; i < length; i++) {
            let element = elements[i]
            let title = element.querySelector('.thread-link.cept-tt')
            let temperature = element.querySelector('.vote-temp')
            let merchant = element.querySelector('.cept-merchant-name')
            if (title) {
                deals.push({
                    title: title.textContent.trim(),
                    url: title.href,
                    temperature: temperature ? parseInt(temperature.textContent.trim()) : 100,
                    merchant: merchant ? merchant.textContent.trim() : ''
                })
            }
        }
        return deals
    })

    console.log(deals.length, 'deals extracted')
    deals = deals.filter(deal => deal.temperature > 200)
    console.log(deals.length, 'deals filtered')

    await browser.close()

    return deals
}

scrape().then((deals) => {
    console.log(deals) // Success!
})
