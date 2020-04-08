import React from 'react'
import { QRcodePage } from '../QRcodePage'
import { i18n } from '@lingui/core'
import { waitFor, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider, theme } from '@chakra-ui/core'
import { I18nProvider } from '@lingui/react'
import { MockedProvider } from '@apollo/react-testing'
import { UserStateProvider } from '../UserState'
import { GENERATE_OTP_URL } from '../graphql/queries'

i18n.load('en', { en: {} })
i18n.activate('en')

const email = 'foo@example.com'
const resolvers = {
  Query: {
    jwt: () => 'string',
    tfa: () => true,
    userName: () => email,
  },
}

describe('<QRcodePage />', () => {
  describe('given a logged in user', () => {
    it('renders an OTP as an SVG QR code', async () => {
      const mocks = [
        {
          request: {
            query: GENERATE_OTP_URL,
            variables: { email },
          },
          result: {
            data: {
              generateOtpUrl:
                'otpauth://totp/Secure%20App:foo%40example.com?secret=XXXXXXXXXXXXXXX&issuer=Secure%20App',
            },
          },
        },
      ]
      const { queryByText, getByRole } = render(
        <UserStateProvider
          initialState={{
            userName: email,
            jwt: null,
            tfa: null,
          }}
        >
          <MockedProvider mocks={mocks} resolvers={resolvers}>
            <MemoryRouter initialEntries={['/']}>
              <ThemeProvider theme={theme}>
                <I18nProvider i18n={i18n}>
                  <QRcodePage />
                </I18nProvider>
              </ThemeProvider>
            </MemoryRouter>
          </MockedProvider>
        </UserStateProvider>,
      )

      await waitFor(() => {
        const qrcode = getByRole('img')
        expect(qrcode.nodeName).toEqual('svg')
        expect(queryByText(/Scan this QR code/i)).toBeInTheDocument()
      })
    })
  })
})
