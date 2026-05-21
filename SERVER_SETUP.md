# VPS Server Setup — TiendaOS

## Server Info
- **Provider**: Hetzner
- **IP**: 178.156.195.220
- **User**: root
- **OS**: Ubuntu (OpenSSH 9.6p1)

## SSH Access (Mac → VPS)

### Problem
SSH was refusing connections due to:
1. `sshd` not installed initially (installed via `apt install openssh-server`)
2. `PubkeyAuthentication` was commented out in `/etc/ssh/sshd_config`
3. `/etc/ssh/sshd_config.d/50-cloud-init.conf` had `PasswordAuthentication yes` overriding the main config
4. `fail2ban` kept banning the Mac IP after failed password attempts
5. Hetzner web console was corrupting the `authorized_keys` file (replacing underscores with dashes)

### Solution
1. Generate SSH key on Mac:
   ```bash
   ssh-keygen -t ed25519 -C "dylan@tiendaos" -f ~/.ssh/id_ed25519 -N ""
   ```

2. Add public key to server via Hetzner console:
   ```bash
   cp /dev/null /root/.ssh/authorized_keys
   echo ssh-ed25519 <PUBLIC_KEY> >> /root/.ssh/authorized_keys
   chmod 700 /root/.ssh && chmod 600 /root/.ssh/authorized_keys
   ```

3. Enable public key auth in `/etc/ssh/sshd_config`:
   ```
   PubkeyAuthentication yes
   ```

4. Disable password auth in `/etc/ssh/sshd_config.d/50-cloud-init.conf`:
   ```
   PasswordAuthentication no
   ```

5. Restart SSH:
   ```bash
   systemctl restart ssh
   ```

### Connect
```bash
ssh -i ~/.ssh/id_ed25519 root@178.156.195.220
```

## Security Notes
- Server is under constant brute-force attacks (47k+ failed attempts logged)
- `fail2ban` is active and will ban your IP after failed attempts
- To unban your IP: `fail2ban-client unban <YOUR_IP>`
- Get your IPv4: `curl -4 ifconfig.me`
- `PasswordAuthentication` is now disabled — key-only access

## Version Status
- VPS is behind GitHub — needs `git pull` to sync latest changes
- Staging environment available for testing before deploy
