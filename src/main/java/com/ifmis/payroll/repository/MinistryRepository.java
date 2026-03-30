package com.ifmis.payroll.repository;

import com.ifmis.payroll.entity.master.Ministry;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface MinistryRepository extends JpaRepository<Ministry, UUID> {
}
