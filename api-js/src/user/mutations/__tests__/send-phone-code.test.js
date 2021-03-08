import { ensure, dbNameFromFile } from 'arango-tools'
import bcrypt from 'bcryptjs'
import { graphql, GraphQLSchema, GraphQLError } from 'graphql'
import { setupI18n } from '@lingui/core'

import englishMessages from '../../../locale/en/messages'
import frenchMessages from '../../../locale/fr/messages'
import { databaseOptions } from '../../../../database-options'
import { createQuerySchema } from '../../../query'
import { createMutationSchema } from '../../../mutation'
import { cleanseInput } from '../../../validators'
import { tokenize } from '../../../auth'
import { userLoaderByKey, userLoaderByUserName } from '../../loaders'

const { DB_PASS: rootPass, DB_URL: url } = process.env
const mockNotify = jest.fn()

describe('user send password reset email', () => {
  const originalInfo = console.info
  afterEach(() => (console.info = originalInfo))

  let query, drop, truncate, collections, schema, request, i18n

  beforeAll(async () => {
    schema = new GraphQLSchema({
      query: createQuerySchema(),
      mutation: createMutationSchema(),
    })
    request = {
      protocol: 'https',
      get: (text) => text,
    }
    ;({ query, drop, truncate, collections } = await ensure({
      type: 'database',
      name: dbNameFromFile(__filename),
      url,
      rootPassword: rootPass,
      options: databaseOptions({ rootPass }),
    }))
  })

  const consoleOutput = []
  const mockedInfo = (output) => consoleOutput.push(output)
  const mockedWarn = (output) => consoleOutput.push(output)
  const mockedError = (output) => consoleOutput.push(output)
  beforeEach(async () => {
    console.info = mockedInfo
    console.warn = mockedWarn
    console.error = mockedError
    consoleOutput.length = 0
  })

  afterEach(async () => {
    await truncate()
  })

  afterAll(async () => {
    await drop()
  })

  describe('users language is set to english', () => {
    beforeAll(() => {
      i18n = setupI18n({
        locale: 'en',
        localeData: {
          en: { plurals: {} },
          fr: { plurals: {} },
        },
        locales: ['en', 'fr'],
        messages: {
          en: englishMessages.messages,
          fr: frenchMessages.messages,
        },
      })
    })
    describe('successfully send a phone code', () => {
      beforeEach(async () => {
        await collections.users.save({
          userName: 'test.account@istio.actually.exists',
          displayName: 'Test Account',
          preferredLang: 'french',
          tfaValidated: false,
          emailValidated: false,
        })
      })
      it('returns status text', async () => {
        const cursor = await query`
          FOR user IN users
              FILTER user.userName == "test.account@istio.actually.exists"
              RETURN MERGE({ id: user._key }, user)
        `
        let user = await cursor.next()

        const response = await graphql(
          schema,
          `
            mutation {
              sendPhoneCode(input: { phoneNumber: "+12345678901" }) {
                result {
                  ... on SendPhoneCodeResult {
                    status
                  }
                  ... on SendPhoneCodeError {
                    code
                    description
                  }
                }
              }
            }
          `,
          null,
          {
            i18n,
            request,
            userKey: user._key,
            query,
            auth: {
              bcrypt,
              tokenize,
            },
            validators: {
              cleanseInput,
            },
            loaders: {
              userLoaderByKey: userLoaderByKey(query),
            },
            notify: {
              sendTfaTextMsg: mockNotify,
            },
          },
        )

        const expectedResult = {
          data: {
            sendPhoneCode: {
              result: {
                status:
                  'Two factor code has been successfully sent, you will receive a text message shortly.',
              },
            },
          },
        }

        user = await userLoaderByUserName(query, '1', {}).load(
          'test.account@istio.actually.exists',
        )

        expect(response).toEqual(expectedResult)
        expect(mockNotify).toHaveBeenCalledWith({
          phoneNumber: '+12345678901',
          user,
        })
        expect(consoleOutput).toEqual([
          `User: ${user._key} successfully sent tfa code.`,
        ])
      })
    })
    describe('unsuccessful phone code sending', () => {
      let user
      beforeEach(async () => {
        user = await collections.users.save({
          userName: 'test.account@istio.actually.exists',
          displayName: 'Test Account',
          preferredLang: 'english',
          tfaValidated: false,
          emailValidated: false,
        })
      })
      describe('no user associated with account', () => {
        it('returns status text', async () => {
          const response = await graphql(
            schema,
            `
              mutation {
                sendPhoneCode(input: { phoneNumber: "+12345678901" }) {
                  result {
                    ... on SendPhoneCodeResult {
                      status
                    }
                    ... on SendPhoneCodeError {
                      code
                      description
                    }
                  }
                }
              }
            `,
            null,
            {
              i18n,
              request,
              userKey: 1,
              query,
              auth: {
                bcrypt,
                tokenize,
              },
              validators: {
                cleanseInput,
              },
              loaders: {
                userLoaderByKey: userLoaderByKey(query),
              },
              notify: {
                sendTfaTextMsg: mockNotify,
              },
            },
          )

          const error = {
            data: {
              sendPhoneCode: {
                result: {
                  code: 400,
                  description: 'Unable to send TFA code, please try again.',
                },
              },
            },
          }

          expect(response).toEqual(error)
          expect(consoleOutput).toEqual([
            `User attempted to send TFA text message, however no account is associated with this key: 1.`,
          ])
        })
      })
      describe('userKey is undefined', () => {
        it('error message', async () => {
          const response = await graphql(
            schema,
            `
              mutation {
                sendPhoneCode(input: { phoneNumber: "+12345678901" }) {
                  result {
                    ... on SendPhoneCodeResult {
                      status
                    }
                    ... on SendPhoneCodeError {
                      code
                      description
                    }
                  }
                }
              }
            `,
            null,
            {
              i18n,
              request,
              userKey: undefined,
              query,
              auth: {
                bcrypt,
                tokenize,
              },
              validators: {
                cleanseInput,
              },
              loaders: {
                userLoaderByKey: userLoaderByKey(query),
              },
              notify: {
                sendTfaTextMsg: mockNotify,
              },
            },
          )

          const error = {
            data: {
              sendPhoneCode: {
                result: {
                  code: 400,
                  description: 'Authentication error, please sign in again.',
                },
              },
            },
          }

          expect(response).toEqual(error)
          expect(consoleOutput).toEqual([
            `User attempted to send TFA text message, however the userKey does not exist.`,
          ])
        })
      })
      describe('database error occurs on tfa code insert', () => {
        it('returns an error message', async () => {
          const loaderById = userLoaderByKey(query)

          const mockedQuery = jest
            .fn()
            .mockRejectedValue(new Error('Database error occurred.'))

          const response = await graphql(
            schema,
            `
              mutation {
                sendPhoneCode(input: { phoneNumber: "+12345678901" }) {
                  result {
                    ... on SendPhoneCodeResult {
                      status
                    }
                    ... on SendPhoneCodeError {
                      code
                      description
                    }
                  }
                }
              }
            `,
            null,
            {
              i18n,
              request,
              userKey: user._key,
              query: mockedQuery,
              auth: {
                bcrypt,
                tokenize,
              },
              validators: {
                cleanseInput,
              },
              loaders: {
                userLoaderByKey: loaderById,
              },
              notify: {
                sendTfaTextMsg: mockNotify,
              },
            },
          )

          const error = [
            new GraphQLError('Unable to send TFA code, please try again.'),
          ]

          expect(response.errors).toEqual(error)
          expect(consoleOutput).toEqual([
            `Database error occurred when inserting ${user._key} TFA code: Error: Database error occurred.`,
          ])
        })
      })
      describe('database error occurs on phone number insert', () => {
        it('returns an error message', async () => {
          const loaderById = userLoaderByKey(query)

          const mockedQuery = jest
            .fn()
            .mockResolvedValueOnce(query)
            .mockRejectedValue(new Error('Database error occurred.'))

          const response = await graphql(
            schema,
            `
              mutation {
                sendPhoneCode(input: { phoneNumber: "+12345678901" }) {
                  result {
                    ... on SendPhoneCodeResult {
                      status
                    }
                    ... on SendPhoneCodeError {
                      code
                      description
                    }
                  }
                }
              }
            `,
            null,
            {
              i18n,
              request,
              userKey: user._key,
              query: mockedQuery,
              auth: {
                bcrypt,
                tokenize,
              },
              validators: {
                cleanseInput,
              },
              loaders: {
                userLoaderByKey: loaderById,
              },
              notify: {
                sendTfaTextMsg: mockNotify,
              },
            },
          )

          const error = [
            new GraphQLError('Unable to send TFA code, please try again.'),
          ]

          expect(response.errors).toEqual(error)
          expect(consoleOutput).toEqual([
            `Database error occurred when inserting ${user._key} phone number: Error: Database error occurred.`,
          ])
        })
      })
    })
  })
  describe('users language is set to french', () => {
    beforeAll(() => {
      i18n = setupI18n({
        locale: 'fr',
        localeData: {
          en: { plurals: {} },
          fr: { plurals: {} },
        },
        locales: ['en', 'fr'],
        messages: {
          en: englishMessages.messages,
          fr: frenchMessages.messages,
        },
      })
    })
    describe('successfully send a phone code', () => {
      let user
      beforeEach(async () => {
        user = await collections.users.save({
          userName: 'test.account@istio.actually.exists',
          displayName: 'Test Account',
          preferredLang: 'english',
          tfaValidated: false,
          emailValidated: false,
        })
      })
      it('returns status text', async () => {
        const response = await graphql(
          schema,
          `
            mutation {
              sendPhoneCode(input: { phoneNumber: "+12345678901" }) {
                result {
                  ... on SendPhoneCodeResult {
                    status
                  }
                  ... on SendPhoneCodeError {
                    code
                    description
                  }
                }
              }
            }
          `,
          null,
          {
            i18n,
            request,
            userKey: user._key,
            query,
            auth: {
              bcrypt,
              tokenize,
            },
            validators: {
              cleanseInput,
            },
            loaders: {
              userLoaderByKey: userLoaderByKey(query),
            },
            notify: {
              sendTfaTextMsg: mockNotify,
            },
          },
        )

        const expectedResult = {
          data: {
            sendPhoneCode: {
              result: {
                status: 'todo',
              },
            },
          },
        }

        user = await userLoaderByUserName(query, '1', {}).load(
          'test.account@istio.actually.exists',
        )

        expect(response).toEqual(expectedResult)
        expect(mockNotify).toHaveBeenCalledWith({
          phoneNumber: '+12345678901',
          user,
        })
        expect(consoleOutput).toEqual([
          `User: ${user._key} successfully sent tfa code.`,
        ])
      })
    })
    describe('unsuccessful phone code sending', () => {
      let user
      beforeEach(async () => {
        user = await collections.users.save({
          userName: 'test.account@istio.actually.exists',
          displayName: 'Test Account',
          preferredLang: 'english',
          tfaValidated: false,
          emailValidated: false,
        })
      })
      describe('no user associated with account', () => {
        it('returns status text', async () => {
          const response = await graphql(
            schema,
            `
              mutation {
                sendPhoneCode(input: { phoneNumber: "+12345678901" }) {
                  result {
                    ... on SendPhoneCodeResult {
                      status
                    }
                    ... on SendPhoneCodeError {
                      code
                      description
                    }
                  }
                }
              }
            `,
            null,
            {
              i18n,
              request,
              userKey: 1,
              query,
              auth: {
                bcrypt,
                tokenize,
              },
              validators: {
                cleanseInput,
              },
              loaders: {
                userLoaderByKey: userLoaderByKey(query),
              },
              notify: {
                sendTfaTextMsg: mockNotify,
              },
            },
          )

          const error = {
            data: {
              sendPhoneCode: {
                result: {
                  code: 400,
                  description: 'todo',
                },
              },
            },
          }

          expect(response).toEqual(error)
          expect(consoleOutput).toEqual([
            `User attempted to send TFA text message, however no account is associated with this key: 1.`,
          ])
        })
      })
      describe('userKey is undefined', () => {
        it('error message', async () => {
          const response = await graphql(
            schema,
            `
              mutation {
                sendPhoneCode(input: { phoneNumber: "+12345678901" }) {
                  result {
                    ... on SendPhoneCodeResult {
                      status
                    }
                    ... on SendPhoneCodeError {
                      code
                      description
                    }
                  }
                }
              }
            `,
            null,
            {
              i18n,
              request,
              userKey: undefined,
              query,
              auth: {
                bcrypt,
                tokenize,
              },
              validators: {
                cleanseInput,
              },
              loaders: {
                userLoaderByKey: userLoaderByKey(query),
              },
              notify: {
                sendTfaTextMsg: mockNotify,
              },
            },
          )

          const error = {
            data: {
              sendPhoneCode: {
                result: {
                  code: 400,
                  description: 'todo',
                },
              },
            },
          }

          expect(response).toEqual(error)
          expect(consoleOutput).toEqual([
            `User attempted to send TFA text message, however the userKey does not exist.`,
          ])
        })
      })
      describe('database error occurs on tfa code insert', () => {
        it('returns an error message', async () => {
          const loaderById = userLoaderByKey(query)

          const mockedQuery = jest
            .fn()
            .mockRejectedValue(new Error('Database error occurred.'))

          const response = await graphql(
            schema,
            `
              mutation {
                sendPhoneCode(input: { phoneNumber: "+12345678901" }) {
                  result {
                    ... on SendPhoneCodeResult {
                      status
                    }
                    ... on SendPhoneCodeError {
                      code
                      description
                    }
                  }
                }
              }
            `,
            null,
            {
              i18n,
              request,
              userKey: user._key,
              query: mockedQuery,
              auth: {
                bcrypt,
                tokenize,
              },
              validators: {
                cleanseInput,
              },
              loaders: {
                userLoaderByKey: loaderById,
              },
              notify: {
                sendTfaTextMsg: mockNotify,
              },
            },
          )
          const error = [new GraphQLError('todo')]

          expect(response.errors).toEqual(error)
          expect(consoleOutput).toEqual([
            `Database error occurred when inserting ${user._key} TFA code: Error: Database error occurred.`,
          ])
        })
      })
      describe('database error occurs on phone number insert', () => {
        it('returns an error message', async () => {
          const loaderById = userLoaderByKey(query)

          const mockedQuery = jest
            .fn()
            .mockResolvedValueOnce(query)
            .mockRejectedValue(new Error('Database error occurred.'))

          const response = await graphql(
            schema,
            `
              mutation {
                sendPhoneCode(input: { phoneNumber: "+12345678901" }) {
                  result {
                    ... on SendPhoneCodeResult {
                      status
                    }
                    ... on SendPhoneCodeError {
                      code
                      description
                    }
                  }
                }
              }
            `,
            null,
            {
              i18n,
              request,
              userKey: user._key,
              query: mockedQuery,
              auth: {
                bcrypt,
                tokenize,
              },
              validators: {
                cleanseInput,
              },
              loaders: {
                userLoaderByKey: loaderById,
              },
              notify: {
                sendTfaTextMsg: mockNotify,
              },
            },
          )

          const error = [new GraphQLError('todo')]

          expect(response.errors).toEqual(error)
          expect(consoleOutput).toEqual([
            `Database error occurred when inserting ${user._key} phone number: Error: Database error occurred.`,
          ])
        })
      })
    })
  })
})
