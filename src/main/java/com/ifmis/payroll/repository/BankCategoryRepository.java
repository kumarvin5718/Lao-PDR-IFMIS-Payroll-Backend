package com.ifmis.payroll.repository;

import com.ifmis.payroll.entity.master.BankCategory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface BankCategoryRepository extends JpaRepository<BankCategory, UUID> {
    Optional<BankCategory> findByName(String name);
}
