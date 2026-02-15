export type GitHubUser = {
    sub: string;
    email?: string;
    name?: string;
    login?: string;
};
export declare function verifyGitHubToken(accessToken: string): Promise<GitHubUser>;
