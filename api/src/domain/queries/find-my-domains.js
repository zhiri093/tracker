import { GraphQLBoolean, GraphQLString, GraphQLList } from 'graphql'
import { connectionArgs } from 'graphql-relay'

import { domainFilter, domainOrder } from '../inputs'
import { domainConnection } from '../objects'

export const findMyDomains = {
  type: domainConnection.connectionType,
  description: 'Select domains a user has access to.',
  args: {
    orderBy: {
      type: domainOrder,
      description: 'Ordering options for domain connections.',
    },
    ownership: {
      type: GraphQLBoolean,
      description: 'Limit domains to those that belong to an organization that has ownership.',
    },
    search: {
      type: GraphQLString,
      description: 'String used to search for domains.',
    },
    isAffiliated: {
      type: GraphQLBoolean,
      description: 'Filter the results based on the users affiliation.',
    },
    filters: {
      type: new GraphQLList(domainFilter),
      description: 'Filters used to limit domains returned.',
    },
    ...connectionArgs,
  },
  resolve: async (
    _,
    args,
    {
      userKey,
      auth: { checkSuperAdmin, userRequired, loginRequiredBool, verifiedRequired },
      loaders: { loadDomainConnectionsByUserId },
    },
  ) => {
    if (loginRequiredBool) {
      const user = await userRequired()
      verifiedRequired({ user })
    }

    const isSuperAdmin = await checkSuperAdmin()

    const domainConnections = await loadDomainConnectionsByUserId({
      isSuperAdmin,
      ...args,
    })

    console.info(`User: ${userKey} successfully retrieved their domains.`)

    return domainConnections
  },
}
