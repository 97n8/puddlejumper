export async function verifyGitHubToken(accessToken) {
    if (!accessToken)
        throw new Error('No token');
    const res = await fetch('https://api.github.com/user', {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
            'User-Agent': 'PuddleJumper/LogicCommons',
        },
    });
    if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`GitHub /user error ${res.status} ${txt}`);
    }
    const json = (await res.json());
    const id = json.id ? String(json.id) : undefined;
    if (!id)
        throw new Error('Missing github id');
    return {
        sub: id,
        email: json.email ?? `${json.login}@users.noreply.github.com`,
        name: json.name ?? json.login,
        login: json.login,
    };
}
