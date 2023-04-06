import { GraphQLObjectType } from 'graphql'
import { connectionArgs, globalIdField } from 'graphql-relay'
import { GraphQLDateTime } from 'graphql-scalars'

import { domainStatus } from '../../domain/objects'
import { Domain } from '../../scalars'
import { verifiedOrganizationOrder } from '../../verified-organizations/inputs'
import { verifiedOrganizationConnection } from '../../verified-organizations/objects'
import { nodeInterface } from '../../node'

export const verifiedDomainType = new GraphQLObjectType({
  name: 'VerifiedDomain',
  fields: () => ({
    id: globalIdField('verifiedDomain'),
    domain: {
      type: Domain,
      description: 'Domain that scans will be ran on.',
      resolve: ({ domain }) => domain,
    },
    lastRan: {
      type: GraphQLDateTime,
      description: 'The last time that a scan was ran on this domain.',
      resolve: ({ lastRan }) => lastRan,
    },
    status: {
      type: domainStatus,
      description: 'The domains scan status, based on the latest scan data.',
      resolve: ({ status }) => status,
    },
    organizations: {
      type: verifiedOrganizationConnection.connectionType,
      args: {
        orderBy: {
          type: verifiedOrganizationOrder,
          description: 'Ordering options for verified organization connections.',
        },
        ...connectionArgs,
      },
      description: 'The organization that this domain belongs to.',
      resolve: async ({ _id }, args, { loaders: { loadVerifiedOrgConnectionsByDomainId } }) => {
        const orgs = await loadVerifiedOrgConnectionsByDomainId({
          domainId: _id,
          ...args,
        })
        return orgs
      },
    },
  }),
  interfaces: [nodeInterface],
  description: 'Domain object containing information for a given domain.',
})
