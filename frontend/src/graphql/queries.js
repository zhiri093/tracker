import gql from 'graphql-tag'

export const DOMAINS = gql`
  {
    domains(organization: BOC) {
      edges {
        node {
          url
        }
      }
    }
  }
`

export const GENERATE_OTP_URL = gql`
  query GenerateOtpUrl($email: EmailAddress!) {
    generateOtpUrl(email: $email)
  }
`
