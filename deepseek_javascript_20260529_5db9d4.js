const roleCheck = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Usuário não autenticado.' });
    }

    if (!allowedRoles.includes(req.user.user_type)) {
      return res.status(403).json({ 
        error: `Acesso negado. Role '${req.user.user_type}' não tem permissão.` 
      });
    }

    next();
  };
};

module.exports = roleCheck;