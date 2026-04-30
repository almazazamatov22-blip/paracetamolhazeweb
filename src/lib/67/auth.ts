import type { NextAuthOptions, Profile } from 'next-auth';
import TwitchProvider from 'next-auth/providers/twitch';
import { db } from '@/lib/db';

export const authOptions: NextAuthOptions = {
  providers: [
    TwitchProvider({
      clientId: process.env.TWITCH_CLIENT_ID!,
      clientSecret: process.env.TWITCH_CLIENT_SECRET!,
      authorization: { params: { scope: 'user:read:email' } },
    }),
  ],
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  callbacks: {
    // On first sign-in, create/update user in DB
    async signIn({ account, profile }) {
      if (!account || !profile) return true;
      const twitchId = account.providerAccountId;
      const displayName = (profile as any).display_name || (profile as any).login || profile.name;
      const login = (profile as any).login || displayName;
      const image = (profile as any).profile_image_url || profile.image;

      await db.user.upsert({
        where: { twitchId },
        create: {
          twitchId,
          username: displayName,
          login,
          image,
        },
        update: {
          username: displayName,
          login,
          image,
        },
      });
      return true;
    },

    async jwt({ token, account, profile, user }) {
      // First time: store twitch id from account
      if (account) token.twitchId = account.providerAccountId;
      if (profile) {
        token.login = (profile as any).login || profile.name;
        token.displayName = (profile as any).display_name || profile.name;
        token.picture = (profile as any).profile_image_url || profile.image;
      }
      // Find our DB user to get the internal id
      if (token.twitchId) {
        const u = await db.user.findUnique({ where: { twitchId: token.twitchId as string } });
        if (u) token.id = u.id;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).login = token.login;
        (session.user as any).displayName = token.displayName;
      }
      return session;
    },
  },
  pages: { signIn: '/' },
  secret: process.env.NEXTAUTH_SECRET,
};
